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
/** `snippet('note')`, `collection('notes')` with a literal name. */
const SNIPPET = /\bsnippet\(\s*['"]([\w/-]+)['"]/g;
const COLLECTION = /\bcollection\(\s*['"]([\w/-]+)['"]/g;
/** Any PHP file of a site or plugin root, which may use snippets and collections. */
const ROOT_PHP =
  /^(?:(.*)\/)?(?:models|controllers|templates|snippets|collections)\/.+\.php$/;
/** `extends: tabs/x`, or a tab, section or field given by its id: `files: sections/x`. */
const REFERENCE =
  /^[\s-]*(?:[\w-]+:\s*)?((?:tabs|sections|fields|blocks|layouts|pages|files|users)\/[\w/-]+)\s*$/gm;

/**
 * Kirby: blueprints describe the pages, and everything else names them by
 * their id, so a change is read blueprint first:
 *  - `<root>/blueprints/tabs/x.yml` defines `tabs/x` (a plugin registers
 *    and reuses it by that id), `blueprints/pages/x.yml` also the template
 *    name `x` (`pageModels`, `templates`);
 *  - a blueprint is made of the blueprints it extends (`extends: tabs/x`)
 *    or uses by id (`timelogs: tabs/x`), read as its parts;
 *  - `blueprints/pages/x.yml` comes before `models/x.php`,
 *    `controllers/x.php` and `templates/x.php` of the same site or plugin,
 *    the model before the controller, both before the template (it gets
 *    the controller's variables and calls the model's methods);
 *  - `snippet('x')` reads `snippets/x.php` as a part, `collection('x')`
 *    reads `collections/x.php` first.
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
    const blueprint = this.blueprint(f.path);
    if (blueprint) {
      const { root, id } = blueprint;
      const definitions = [id];
      if (id.startsWith("pages/")) {
        definitions.push(id.slice("pages/".length));
      }
      const parts: string[] = [];
      for (const m of f.content?.matchAll(REFERENCE) ?? []) {
        const target = this.resolve(m[1] ?? "", root);
        if (target && target !== f.path && !parts.includes(target)) {
          parts.push(target);
        }
      }
      return parts.length ? { definitions, parts } : { definitions };
    }
    const php = ROOT_PHP.exec(f.path);
    const root = php?.[1] ?? "";
    if (!php || !this.roots.has(root)) {
      return undefined;
    }
    const dependsOn: { path: string; via: string }[] = [];
    const code = PAGE_CODE.exec(f.path);
    if (code) {
      const [, , kind = "", name = ""] = code;
      const blueprint = this.resolve(`pages/${name}`, root);
      if (blueprint) {
        dependsOn.push({ path: blueprint, via: BLUEPRINT_VIA[kind] ?? "" });
      }
      for (const b of BEFORE[kind] ?? []) {
        const path = this.code(`${b.kind}/${name}`, root);
        if (path) {
          dependsOn.push({ path, via: b.via });
        }
      }
    }
    const parts: string[] = [];
    for (const m of f.content?.matchAll(COLLECTION) ?? []) {
      const path = this.code(`collections/${m[1]}`, root);
      if (path && !dependsOn.some((d) => d.path === path)) {
        dependsOn.push({ path, via: "uses the collection" });
      }
    }
    for (const m of f.content?.matchAll(SNIPPET) ?? []) {
      const path = this.code(`snippets/${m[1]}`, root);
      if (path && path !== f.path && !parts.includes(path)) {
        parts.push(path);
      }
    }
    if (!dependsOn.length && !parts.length) {
      return undefined;
    }
    return {
      ...(dependsOn.length ? { dependsOn } : {}),
      ...(parts.length ? { parts } : {}),
    };
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

  private inRoot(id: string, root: string): string | undefined {
    const prefix = root ? `${root}/blueprints/` : "blueprints/";
    return this.byId.get(id)?.find((p) => p.startsWith(prefix));
  }

  /** A blueprint id: its root's own first, else the only one in the repository. */
  private resolve(id: string, root: string): string | undefined {
    const all = this.byId.get(id) ?? [];
    return this.inRoot(id, root) ?? (all.length === 1 ? all[0] : undefined);
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
