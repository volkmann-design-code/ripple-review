import type {
  FrameworkFacts,
  FrameworkFile,
  FrameworkRule,
} from "@ripple-review/core/framework";
import type { AdapterContext } from "@ripple-review/core/model";
import { dirOf } from "@ripple-review/core/paths";

const GMRC = /(^|\/)\.gmrc(\.[cm]?js)?$/;
/** A migrations folder: the one holding `committed/`, `current.sql` or `current/`. */
const IN_MIGRATIONS =
  /^(.*?)\/(?:committed\/[^/]+\.sql|current\.sql|current\/.+\.sql)$/;
/**
 * `--! include x.sql` in the current migration, and its expanded form in
 * committed ones: `--! Included x.sql` … `--! EndIncluded x.sql`.
 */
const INCLUDE = /^--!\s*included?\s+(\S+)/gim;

/**
 * graphile-migrate: a migration is made of the fixtures it includes (paths
 * relative to `<migrations>/fixtures`), read as its parts. Detected by a
 * `.gmrc` file; its migrations folder is found by its layout, not read from
 * the `.gmrc` (recordings don't keep it).
 */
export class GraphileMigrate implements FrameworkRule {
  readonly id = "graphile-migrate";
  readonly name = "graphile-migrate";
  private paths: ReadonlySet<string> = new Set();
  /** Migrations folders, longest first. */
  private folders: string[] = [];

  detect(ctx: AdapterContext): Promise<boolean> {
    this.paths = ctx.paths;
    const roots = [...ctx.paths]
      .filter((p) => GMRC.test(p))
      .map((p) => dirOf(p));
    const folders = new Set<string>();
    for (const p of ctx.paths) {
      const m = IN_MIGRATIONS.exec(p);
      if (m?.[1] && roots.some((r) => r === "" || m[1]!.startsWith(`${r}/`))) {
        folders.add(m[1]);
      }
    }
    this.folders = [...folders].sort((a, b) => b.length - a.length);
    return Promise.resolve(this.folders.length > 0);
  }

  file(f: FrameworkFile): FrameworkFacts | undefined {
    if (!f.path.endsWith(".sql") || f.content === undefined) {
      return undefined;
    }
    const folder = this.folders.find((d) => f.path.startsWith(`${d}/`));
    if (!folder) {
      return undefined;
    }
    const parts: string[] = [];
    for (const m of f.content.matchAll(INCLUDE)) {
      const target = `${folder}/fixtures/${m[1]}`;
      if (this.paths.has(target) && !parts.includes(target)) {
        parts.push(target);
      }
    }
    return parts.length ? { parts } : undefined;
  }
}
