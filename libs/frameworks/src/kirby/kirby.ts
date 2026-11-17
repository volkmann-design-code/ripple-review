import type {
  FrameworkFacts,
  FrameworkFile,
  FrameworkRule,
} from "@ripple-review/core/framework";
import type { AdapterContext, Role } from "@ripple-review/core/model";

/** `<root>/blueprints/<id>.yml`: a blueprint and the id Kirby knows it by. */
const BLUEPRINT = /^(?:(.*)\/)?blueprints\/(.+)\.ya?ml$/;
/** A page's model, controller or template in a site or plugin root. */
const PAGE_CODE =
  /^(?:(.*)\/)?(models|controllers|templates)\/([^/.]+)(?:\.[^/]+)?\.php$/;
/** What comes before a page's code, and how it reads. */
const BEFORE: Record<string, { kind: string; via: string }[]> = {
  models: [],
  controllers: [{ kind: "models", via: "uses the model" }],
  templates: [
    { kind: "models", via: "uses the model" },
    { kind: "controllers", via: "gets its variables from" },
  ],
};
const BLUEPRINT_VIA: Record<string, string> = {
  models: "model of",
  controllers: "controller of",
  templates: "template of",
};
/** A block's snippet, named by its type: `snippets/blocks/x.php`. */
const BLOCK_SNIPPET = /^(?:(.*)\/)?snippets\/blocks\/([\w-]+)\.php$/;
/** Any PHP file of a site or plugin root. */
const ROOT_PHP =
  /^(?:(.*)\/)?(?:models|controllers|templates|snippets|collections)\/.+\.php$/;
/** `snippet('note')`, `collection('notes')` with a literal name. */
const SNIPPET = /\bsnippet\(\s*['"]([\w/-]+)['"]/g;
const COLLECTION = /\bcollection\(\s*['"]([\w/-]+)['"]/g;
/**
 * A page template named in PHP: `'template' => 'note'`,
 * `->template('note')`, `template() == 'note'`, `template()->name() === 'note'`.
 */
const PHP_TEMPLATE =
  /(?:['"]template['"]\s*=>\s*|->template\(\s*|\btemplate\(\)(?:->name\(\))?\s*[!=]==?\s*)['"]([\w-]+)['"]/g;
/** A blueprint given by its id: `files: sections/x`, `- tabs/x`. */
const REFERENCE =
  /^[\s-]*(?:[\w-]+:\s*)?((?:tabs|sections|fields|blocks|layouts|pages|files|users)\/[\w/-]+)\s*$/gm;
/** Kinds a bare `extends: x` may mean, when only one of them has an `x`. */
const EXTENDABLE = ["fields", "sections", "tabs", "blocks", "layouts"];

/**
 * Kirby: a file's name is its key, and everything refers to it by that name.
 * A change is read definition first:
 *  - `<root>/blueprints/tabs/x.yml` defines `tabs/x` (a plugin registers
 *    and reuses it by that id), `blueprints/pages/x.yml` also the template
 *    name `x` (`pageModels`, `templates`);
 *  - a blueprint is made of the blueprints it extends (`extends: tabs/x`;
 *    `extends: x` when only one kind has an `x`) or uses by id
 *    (`timelogs: tabs/x`), read as its parts;
 *  - a blueprint naming templates (`template: x`, `templates:`, `create:`)
 *    or blocks (`fieldsets:`) reads `pages/x`, `files/x`, `blocks/x` first;
 *  - `blueprints/pages/x.yml` comes before `models/x.php`,
 *    `controllers/x.php` and `templates/x.php` of the same site or plugin,
 *    the model before the controller, both before the template (it gets
 *    the controller's variables and calls the model's methods);
 *    `blueprints/blocks/x.yml` before `snippets/blocks/x.php`;
 *  - in PHP, `snippet('x')` reads `snippets/x.php` as a part,
 *    `collection('x')` reads `collections/x.php` first, and a template
 *    named (`'template' => 'x'`, `->template('x')`) `pages/x.yml` first.
 * A root is a site (`…/site`) or a plugin (a folder with `index.php`), found
 * by the layout: composer.json isn't read (recordings don't keep it).
 */
export class Kirby implements FrameworkRule {
  readonly id = "kirby";
  readonly name = "Kirby";
  private paths: ReadonlySet<string> = new Set();
  private roots = new Set<string>();
  /** Blueprint paths by id, across roots: plugins share one registry. */
  private byId = new Map<string, string[]>();

  detect(ctx: AdapterContext): Promise<boolean> {
    this.paths = ctx.paths;
    this.roots = new Set();
    this.byId = new Map();
    for (const p of ctx.paths) {
      const m = BLUEPRINT.exec(p);
      if (!m) {
        continue;
      }
      const [, root = "", id = ""] = m;
      if (!isRoot(root, ctx.paths)) {
        continue;
      }
      this.roots.add(root);
      this.byId.set(id, [...(this.byId.get(id) ?? []), p]);
    }
    return Promise.resolve(this.roots.size > 0);
  }

  file(f: FrameworkFile): FrameworkFacts | undefined {
    const content = f.content ?? "";
    const parts = new Set<string>();
    const first = new Deps();
    const definitions: string[] = [];
    const blueprint = this.blueprint(f.path);
    if (blueprint) {
      const { root, id } = blueprint;
      definitions.push(id);
      if (id.startsWith("pages/")) {
        definitions.push(id.slice("pages/".length));
      }
      for (const m of content.matchAll(REFERENCE)) {
        add(parts, this.resolve(m[1] ?? "", root));
      }
      for (const x of yamlValues(content, "extends")) {
        add(parts, this.extended(x, root));
      }
      for (const key of ["template", "templates", "create"]) {
        for (const x of yamlValues(content, key)) {
          first.add(this.resolve(`pages/${x}`, root), "uses the template");
          first.add(this.resolve(`files/${x}`, root), "uses the template");
        }
      }
      for (const x of yamlValues(content, "fieldsets")) {
        first.add(this.resolve(`blocks/${x}`, root), "uses the block");
      }
    } else {
      const root = ROOT_PHP.exec(f.path)?.[1];
      if (root === undefined || !this.roots.has(root)) {
        return undefined;
      }
      const code = PAGE_CODE.exec(f.path);
      if (code) {
        const [, , kind = "", name = ""] = code;
        first.add(
          this.resolve(`pages/${name}`, root),
          BLUEPRINT_VIA[kind] ?? "",
        );
        for (const b of BEFORE[kind] ?? []) {
          first.add(this.code(`${b.kind}/${name}`, root), b.via);
        }
      }
      const block = BLOCK_SNIPPET.exec(f.path)?.[2];
      if (block) {
        first.add(this.resolve(`blocks/${block}`, root), "snippet of");
      }
      for (const m of content.matchAll(COLLECTION)) {
        first.add(
          this.code(`collections/${m[1]}`, root),
          "uses the collection",
        );
      }
      for (const m of content.matchAll(PHP_TEMPLATE)) {
        first.add(this.resolve(`pages/${m[1]}`, root), "uses the template");
      }
      for (const m of content.matchAll(SNIPPET)) {
        add(parts, this.code(`snippets/${m[1]}`, root));
      }
    }
    parts.delete(f.path);
    const dependsOn = first.list.filter(
      (d) => d.path !== f.path && !parts.has(d.path),
    );
    const facts: FrameworkFacts = {
      ...(definitions.length ? { definitions } : {}),
      ...(parts.size ? { parts: [...parts] } : {}),
      ...(dependsOn.length ? { dependsOn } : {}),
    };
    return Object.keys(facts).length ? facts : undefined;
  }

  roleHint(path: string): Role | undefined {
    return this.blueprint(path) ? "schema" : undefined;
  }

  /** `models/x`, `snippets/x`: the PHP file in the root, else in the only root that has one. */
  private code(name: string, root: string): string | undefined {
    const own = root ? `${root}/${name}.php` : `${name}.php`;
    if (this.paths.has(own)) {
      return own;
    }
    const all = [...this.roots]
      .map((r) => (r ? `${r}/${name}.php` : `${name}.php`))
      .filter((p) => this.paths.has(p));
    return all.length === 1 ? all[0] : undefined;
  }

  private blueprint(path: string): { root: string; id: string } | undefined {
    const m = BLUEPRINT.exec(path);
    const [, root = "", id = ""] = m ?? [];
    return m && this.roots.has(root) ? { root, id } : undefined;
  }

  /** A blueprint id: its root's own first, else the only one in the repository. */
  private resolve(id: string, root: string): string | undefined {
    const all = this.byId.get(id) ?? [];
    const prefix = root ? `${root}/blueprints/` : "blueprints/";
    return (
      all.find((p) => p.startsWith(prefix)) ??
      (all.length === 1 ? all[0] : undefined)
    );
  }

  /** `extends: x`: the blueprint `x`, else the only `<kind>/x`. */
  private extended(x: string, root: string): string | undefined {
    const exact = this.resolve(x, root);
    if (exact || x.includes("/")) {
      return exact;
    }
    const found = EXTENDABLE.map((k) => this.resolve(`${k}/${x}`, root)).filter(
      (p) => p !== undefined,
    );
    return found.length === 1 ? found[0] : undefined;
  }
}

/** A site (`site`, `…/site`) or a plugin (a folder with `index.php`). */
function isRoot(root: string, paths: ReadonlySet<string>): boolean {
  return (
    root === "site" ||
    root.endsWith("/site") ||
    paths.has(root ? `${root}/index.php` : "index.php")
  );
}

/** Files to read first, each once, with how they relate. */
class Deps {
  readonly list: { path: string; via: string }[] = [];
  add(path: string | undefined, via: string): void {
    if (path && !this.list.some((d) => d.path === path)) {
      this.list.push({ path, via });
    }
  }
}

function add(set: Set<string>, path: string | undefined): void {
  if (path) {
    set.add(path);
  }
}

const SCALAR = /^['"]?([\w/-]+)['"]?$/;

/**
 * The names a YAML key gives, wherever it is: `key: x`, `key: [x, y]`, or a
 * block list (`key:` then `- x` lines). Line-based: blueprints are simple
 * enough for that.
 */
function yamlValues(content: string, key: string): string[] {
  const lines = content.split("\n");
  const keyLine = new RegExp(`^\\s*(?:-\\s+)?${key}:\\s*(.*?)\\s*(?:#.*)?$`);
  const out: string[] = [];
  const push = (v: string) => {
    const name = SCALAR.exec(v.trim())?.[1];
    if (name) {
      out.push(name);
    }
  };
  lines.forEach((line, i) => {
    const rest = keyLine.exec(line)?.[1];
    if (rest === undefined) {
      return;
    }
    if (rest.startsWith("[")) {
      rest
        .replace(/^\[|\]$/g, "")
        .split(",")
        .forEach(push);
    } else if (rest) {
      push(rest);
    } else {
      for (const next of lines.slice(i + 1)) {
        const item = /^\s*-\s+(.*?)\s*$/.exec(next)?.[1];
        if (item === undefined) {
          break;
        }
        push(item);
      }
    }
  });
  return out;
}
