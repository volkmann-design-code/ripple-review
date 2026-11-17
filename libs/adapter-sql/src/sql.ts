import type {
  AdapterContext,
  ImportFact,
  LanguageAdapter,
  ModuleFacts,
  Role,
} from "@ripple-review/core/model";
import { dirOf, joinRepo } from "@ripple-review/core/paths";

const CREATE =
  /\bcreate\s+(?:or\s+replace\s+)?(?:temp(?:orary)?\s+|unlogged\s+|materialized\s+)?(function|procedure|table|view|type|sequence|domain|schema)\s+(?:if\s+not\s+exists\s+)?([\w."]+)/gi;
const ADD_COLUMN = /\badd\s+column\s+(?:if\s+not\s+exists\s+)?([\w"]+)/gi;
/**
 * psql `\i x.sql` / `\ir x.sql`. graphile-migrate's `--! include` is the
 * graphile-migrate framework rule's (`libs/frameworks`).
 */
const INCLUDES = [/^\\ir?\s+(\S+)/gm];

/**
 * SQL: what a file creates (functions, tables, views, types, added columns)
 * becomes a definition other files can mention by name; includes make a
 * migration "contain" the files it pulls in.
 */
export class SqlAdapter implements LanguageAdapter {
  readonly id = "sql";
  private paths: ReadonlySet<string> = new Set();
  private sqlFiles: string[] = [];

  supports(path: string): boolean {
    return path.endsWith(".sql");
  }

  init(ctx: AdapterContext): Promise<void> {
    this.paths = ctx.paths;
    this.sqlFiles = [...ctx.paths].filter((f) => f.endsWith(".sql"));
    return Promise.resolve();
  }

  parse(_path: string, content: string): ModuleFacts {
    const definitions = new Set<string>();
    for (const m of content.matchAll(CREATE)) {
      definitions.add(lastSegment(m[2]!));
    }
    for (const m of content.matchAll(ADD_COLUMN)) {
      definitions.add(unquote(m[1]!));
    }
    const imports: ImportFact[] = [];
    for (const re of INCLUDES) {
      for (const m of content.matchAll(re)) {
        imports.push({ specifier: m[1]!, names: "*", relation: "contains" });
      }
    }
    return {
      imports,
      exports: [...definitions],
      reexports: [],
      definitions: [...definitions],
    };
  }

  resolve(specifier: string, fromPath: string): string | undefined {
    const rel = joinRepo(dirOf(fromPath), specifier);
    if (rel && this.paths.has(rel)) {
      return rel;
    }
    // Include roots vary by tool (graphile-migrate: migrations/fixtures); match by suffix.
    const hits = this.sqlFiles.filter(
      (f) => f === specifier || f.endsWith(`/${specifier}`),
    );
    return hits.sort((a, b) => a.length - b.length)[0];
  }

  roleHint(path: string): Role | undefined {
    return /(^|\/)(migrations?|schema|ddl)\//i.test(path)
      ? "schema"
      : undefined;
  }
}

function unquote(s: string): string {
  return s.replace(/"/g, "");
}

function lastSegment(name: string): string {
  const parts = unquote(name).split(".");
  return parts[parts.length - 1]!;
}
