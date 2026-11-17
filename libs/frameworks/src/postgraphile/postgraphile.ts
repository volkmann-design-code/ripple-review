import type {
  FrameworkFacts,
  FrameworkFile,
  FrameworkRule,
} from "@ripple-review/core/framework";
import type { AdapterContext } from "@ripple-review/core/model";
import { packagesUsing } from "../manifests.ts";

const NAME = String.raw`((?:"?\w+"?\.)?"?\w+"?)`;
const CREATE_RELATION = new RegExp(
  String.raw`\bcreate\s+(?:or\s+replace\s+)?(?:materialized\s+)?(?:table|view)\s+(?:if\s+not\s+exists\s+)?${NAME}`,
  "gi",
);
/** A function and its first argument's type: `create function s.order_total(o s.orders)`. */
const CREATE_FUNCTION = new RegExp(
  String.raw`\bcreate\s+(?:or\s+replace\s+)?function\s+${NAME}\s*\(\s*(?:(?:in\s+)?\w+\s+${NAME})?`,
  "gi",
);
/** `comment on table s.x is E'@name y …'`: a smart comment renaming x. */
const SMART_NAME =
  /\bcomment\s+on\s+(table|view|materialized\s+view|function|column)\s+[^']*?\bis\s+E?'(?:[^']|'')*?@name\s+(\w+)/gi;
/** Schemas PostGraphile doesn't expose, by graphile-starter's convention. */
const PRIVATE_SCHEMA = /(?:^|_)(?:hidden|private)$/;

/**
 * PostGraphile: what a SQL file creates in an exposed schema becomes GraphQL
 * names by the inflection, so a query or code that uses them links to it:
 *  - a table or view `product_campaign`: `ProductCampaign`,
 *    `productCampaign(s)`, `allProductCampaigns`, `productCampaignById`,
 *    `create…`, `update…(ById)`, `delete…(ById)` (default inflection and the
 *    simplify inflector both);
 *  - a function `search_products`: `searchProducts`; a computed column
 *    `orders_total_amount(o orders)`: `totalAmount`;
 *  - a smart comment `@name x`: the names of `x`.
 * Generic name matching links respellings of three words and more already
 * (`set_line_items` ↔ `setLineItems`), so those are left to it; the rule
 * covers the shorter ones and the inflected forms. Schemas named `*_hidden` / `*_private` aren't
 * exposed (graphile-starter's convention), so their names aren't GraphQL's.
 */
export class PostGraphile implements FrameworkRule {
  readonly id = "postgraphile";
  readonly name = "PostGraphile";

  async detect(ctx: AdapterContext): Promise<boolean> {
    return (await packagesUsing(ctx, "postgraphile")).length > 0;
  }

  file(f: FrameworkFile): FrameworkFacts | undefined {
    if (!f.path.endsWith(".sql") || f.content === undefined) {
      return undefined;
    }
    const names = new Set<string>();
    /** The SQL names, as words: their respellings of three words or more link already. */
    const created = new Set<string>();
    const add = (sql: string, list: string[]) => {
      created.add(words(sql).join("_"));
      for (const n of list) {
        names.add(n);
      }
    };
    for (const m of f.content.matchAll(CREATE_RELATION)) {
      const r = exposed(m[1] ?? "");
      if (r) {
        add(r, relationNames(r));
      }
    }
    for (const m of f.content.matchAll(CREATE_FUNCTION)) {
      const fn = exposed(m[1] ?? "");
      if (!fn) {
        continue;
      }
      add(fn, [camel(words(fn))]);
      const table = m[2] ? unqualified(m[2]) : undefined;
      if (table && fn.startsWith(`${table}_`) && fn.length > table.length + 1) {
        names.add(camel(words(fn.slice(table.length + 1))));
      }
    }
    for (const m of f.content.matchAll(SMART_NAME)) {
      const [, kind = "", name = ""] = m;
      add(
        name,
        /(?:table|view)$/i.test(kind)
          ? relationNames(name)
          : [camel(words(name))],
      );
    }
    const definitions = [...names].filter((n) => {
      const w = words(n.replace(/([a-z0-9])([A-Z])/g, "$1_$2"));
      return w.length > 0 && !(w.length >= 3 && created.has(w.join("_")));
    });
    return definitions.length ? { definitions } : undefined;
  }
}

/** The name without its schema, unless the schema isn't exposed. */
function exposed(qualified: string): string | undefined {
  const [schema, name] = qualified.replaceAll('"', "").split(".");
  if (name === undefined) {
    return schema || undefined;
  }
  return schema && PRIVATE_SCHEMA.test(schema) ? undefined : name;
}

function unqualified(qualified: string): string {
  return qualified.replaceAll('"', "").split(".").at(-1) ?? "";
}

/** The GraphQL names of a table or view. */
function relationNames(name: string): string[] {
  const w = words(name);
  const last = w.pop();
  if (last === undefined) {
    return [];
  }
  const one = [...w, singular(last)];
  const many = [...w, plural(singular(last))];
  const type = pascal(one);
  const single = camel(one);
  return [
    type,
    single,
    camel(many),
    `all${pascal(many)}`,
    `${single}ById`,
    `create${type}`,
    `update${type}`,
    `update${type}ById`,
    `delete${type}`,
    `delete${type}ById`,
  ];
}

const words = (name: string) =>
  name
    .toLowerCase()
    .split(/[_\W]+/)
    .filter(Boolean);
const upper = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
const pascal = (w: string[]) => w.map(upper).join("");
const camel = (w: string[]) => {
  const p = pascal(w);
  return p.charAt(0).toLowerCase() + p.slice(1);
};

/** English plurals, as far as table names need them. */
function plural(w: string): string {
  if (/[^aeiou]y$/.test(w)) {
    return `${w.slice(0, -1)}ies`;
  }
  return /(?:s|x|z|ch|sh)$/.test(w) ? `${w}es` : `${w}s`;
}

function singular(w: string): string {
  if (/[^aeiou]ies$/.test(w)) {
    return `${w.slice(0, -3)}y`;
  }
  if (/(?:ss|x|z|ch|sh)es$/.test(w)) {
    return w.slice(0, -2);
  }
  return /[^s]s$/.test(w) && !/(?:us|is)$/.test(w) ? w.slice(0, -1) : w;
}
