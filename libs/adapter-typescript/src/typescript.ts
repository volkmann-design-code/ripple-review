import type {
  AdapterContext,
  ImportFact,
  LanguageAdapter,
  ModuleFacts,
  ReexportFact,
} from "@ripple-review/core/model";
import { dirOf, joinRepo } from "@ripple-review/core/paths";
import ts from "typescript";

const EXTENSIONS = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
];
const JS_TO_TS: Record<string, string[]> = {
  ".js": [".ts", ".tsx"],
  ".jsx": [".tsx"],
  ".mjs": [".mts"],
  ".cjs": [".cts"],
};

interface PathRule {
  configDir: string;
  baseDir: string;
  pattern: string;
  targets: string[];
}

interface WorkspacePackage {
  name: string;
  dir: string;
  exports?: unknown;
  main?: string;
}

/**
 * TypeScript / JavaScript: ES imports, re-exports, dynamic import / require,
 * resolved via relative paths, tsconfig `paths` and workspace packages (`exports`).
 */
export class TypeScriptAdapter implements LanguageAdapter {
  readonly id = "typescript";
  private paths: ReadonlySet<string> = new Set();
  private rules: PathRule[] = [];
  private packages: WorkspacePackage[] = [];
  private resolveCache = new Map<string, string | undefined>();

  supports(path: string): boolean {
    return EXTENSIONS.some((e) => path.endsWith(e));
  }

  async init(ctx: AdapterContext): Promise<void> {
    this.paths = ctx.paths;
    const configs = [...ctx.paths].filter((f) => {
      const base = f.slice(f.lastIndexOf("/") + 1);
      return (
        !f.includes("node_modules/") &&
        (/^tsconfig.*\.json$/.test(base) || base === "package.json")
      );
    });
    // Read together (one batch), loaded in path order as before.
    const texts = await Promise.all(configs.map((f) => ctx.head.read(f)));
    for (const [i, file] of configs.entries()) {
      if (file.endsWith("package.json")) {
        this.loadPackage(file, texts[i]);
      } else {
        this.loadTsconfig(file, texts[i]);
      }
    }
    // Nearest tsconfig first, then longest pattern first.
    this.rules.sort(
      (a, b) =>
        b.configDir.length - a.configDir.length ||
        b.pattern.length - a.pattern.length,
    );
    this.packages.sort((a, b) => b.name.length - a.name.length);
  }

  private loadTsconfig(file: string, text: string | undefined): void {
    if (!text) {
      return;
    }
    const { config } = ts.parseConfigFileTextToJson(file, text);
    const opts = config?.compilerOptions;
    if (!opts?.paths) {
      return;
    }
    const configDir = dirOf(file);
    const baseDir = joinRepo(configDir, opts.baseUrl ?? ".") ?? configDir;
    for (const [pattern, targets] of Object.entries(
      opts.paths as Record<string, string[]>,
    )) {
      this.rules.push({ configDir, baseDir, pattern, targets });
    }
  }

  private loadPackage(file: string, text: string | undefined): void {
    try {
      const pkg = JSON.parse(text ?? "");
      if (typeof pkg.name === "string") {
        this.packages.push({
          name: pkg.name,
          dir: dirOf(file),
          exports: pkg.exports,
          main: pkg.main,
        });
      }
    } catch {
      /* not a valid package.json */
    }
  }

  parse(path: string, content: string): ModuleFacts {
    const sf = ts.createSourceFile(
      path,
      content,
      ts.ScriptTarget.Latest,
      false,
      scriptKind(path),
    );
    const imports: ImportFact[] = [];
    const exports = new Set<string>();
    /** String values other languages refer to literally (setting keys, permissions). */
    const keys = new Set<string>();
    const reexports: ReexportFact[] = [];
    const bindings = new Map<string, { specifier: string; name: string }>();
    const localExports: [string, string][] = [];

    for (const stmt of sf.statements) {
      if (
        ts.isImportDeclaration(stmt) &&
        ts.isStringLiteral(stmt.moduleSpecifier)
      ) {
        const specifier = stmt.moduleSpecifier.text;
        const clause = stmt.importClause;
        if (!clause) {
          imports.push({ specifier, names: "*" });
          continue;
        }
        const names: string[] = [];
        let namespace = false;
        if (clause.name) {
          names.push("default");
          bindings.set(clause.name.text, { specifier, name: "default" });
        }
        const nb = clause.namedBindings;
        if (nb && ts.isNamespaceImport(nb)) {
          namespace = true;
          bindings.set(nb.name.text, { specifier, name: "*" });
        } else if (nb) {
          for (const el of nb.elements) {
            const imported = (el.propertyName ?? el.name).text;
            names.push(imported);
            bindings.set(el.name.text, { specifier, name: imported });
          }
        }
        imports.push({
          specifier,
          names: namespace ? "*" : names,
          typeOnly: clause.isTypeOnly,
        });
      } else if (ts.isExportDeclaration(stmt)) {
        const clause = stmt.exportClause;
        if (stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)) {
          const specifier = stmt.moduleSpecifier.text;
          if (!clause) {
            reexports.push({ specifier, names: "*" });
          } else if (ts.isNamespaceExport(clause)) {
            exports.add(clause.name.text);
            imports.push({ specifier, names: "*" });
          } else {
            reexports.push({
              specifier,
              names: clause.elements.map((e) => ({
                from: (e.propertyName ?? e.name).text,
                as: e.name.text,
              })),
            });
          }
        } else if (clause && ts.isNamedExports(clause)) {
          for (const e of clause.elements) {
            localExports.push([(e.propertyName ?? e.name).text, e.name.text]);
          }
        }
      } else if (ts.isExportAssignment(stmt)) {
        exports.add("default");
      } else {
        const mods = ts.canHaveModifiers(stmt)
          ? ts.getModifiers(stmt)
          : undefined;
        if (!mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
          continue;
        }
        if (mods.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) {
          exports.add("default");
        }
        for (const name of declaredNames(stmt)) {
          exports.add(name);
        }
        for (const key of stringKeys(stmt)) {
          keys.add(key);
        }
      }
    }

    for (const [local, exported] of localExports) {
      const b = bindings.get(local);
      if (!b) {
        exports.add(exported);
      } else if (b.name === "*") {
        exports.add(exported);
      } else {
        reexports.push({
          specifier: b.specifier,
          names: [{ from: b.name, as: exported }],
        });
      }
    }

    if (content.includes("import(") || content.includes("require(")) {
      collectDynamic(sf, imports);
    }
    if (content.includes("@Component") || content.includes("@Directive")) {
      for (const c of angularDeclarations(sf)) {
        imports.push(...c.parts);
        for (const n of c.names) {
          keys.add(n);
        }
      }
    }

    return {
      imports,
      exports: [...exports],
      reexports,
      definitions: [
        ...[...exports].filter((n) => n !== "default"),
        ...[...keys].filter((k) => !exports.has(k)),
      ],
    };
  }

  resolve(specifier: string, fromPath: string): string | undefined {
    const key = specifier.startsWith(".")
      ? `${dirOf(fromPath)}\0${specifier}`
      : `${fromPath}\0${specifier}`;
    if (this.resolveCache.has(key)) {
      return this.resolveCache.get(key);
    }
    const r = this.resolveUncached(specifier, fromPath);
    this.resolveCache.set(key, r);
    return r;
  }

  private resolveUncached(
    specifier: string,
    fromPath: string,
  ): string | undefined {
    if (specifier.startsWith(".")) {
      const p = joinRepo(dirOf(fromPath), specifier);
      return p === undefined ? undefined : this.probe(p);
    }
    for (const rule of this.rules) {
      if (rule.configDir && !fromPath.startsWith(`${rule.configDir}/`)) {
        continue;
      }
      const match = matchPattern(rule.pattern, specifier);
      if (match === undefined) {
        continue;
      }
      for (const t of rule.targets) {
        const p = joinRepo(rule.baseDir, t.replace("*", match));
        const r = p === undefined ? undefined : this.probe(p);
        if (r) {
          return r;
        }
      }
    }
    for (const pkg of this.packages) {
      if (specifier !== pkg.name && !specifier.startsWith(`${pkg.name}/`)) {
        continue;
      }
      return this.resolvePackage(pkg, `.${specifier.slice(pkg.name.length)}`);
    }
    return undefined;
  }

  private resolvePackage(
    pkg: WorkspacePackage,
    sub: string,
  ): string | undefined {
    const targets = exportTargets(pkg.exports, sub);
    const candidates =
      targets.length > 0
        ? targets
        : sub === "."
          ? [pkg.main ?? "index", "src/index"]
          : [sub, `src/${sub.slice(2)}`];
    for (const c of candidates) {
      const p = joinRepo(pkg.dir, c);
      const r = p === undefined ? undefined : this.probe(p);
      if (r) {
        return r;
      }
    }
    return undefined;
  }

  private probe(p: string): string | undefined {
    const tries: string[] = [p];
    const ext = EXTENSIONS.find((e) => p.endsWith(e));
    if (ext && JS_TO_TS[ext]) {
      for (const t of JS_TO_TS[ext]!) {
        tries.push(p.slice(0, -ext.length) + t);
      }
    }
    for (const e of EXTENSIONS) {
      tries.push(p + e);
    }
    for (const e of EXTENSIONS) {
      tries.push(`${p}/index${e}`);
    }
    return tries.find((t) => this.paths.has(t));
  }
}

function scriptKind(path: string): ts.ScriptKind {
  if (path.endsWith(".tsx")) {
    return ts.ScriptKind.TSX;
  }
  if (path.endsWith(".jsx")) {
    return ts.ScriptKind.JSX;
  }
  if (/\.[cm]?js$/.test(path)) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
}

function declaredNames(stmt: ts.Statement): string[] {
  if (ts.isVariableStatement(stmt)) {
    return stmt.declarationList.declarations.flatMap((d) =>
      ts.isIdentifier(d.name) ? [d.name.text] : [],
    );
  }
  if (
    (ts.isFunctionDeclaration(stmt) ||
      ts.isClassDeclaration(stmt) ||
      ts.isInterfaceDeclaration(stmt) ||
      ts.isTypeAliasDeclaration(stmt) ||
      ts.isEnumDeclaration(stmt) ||
      ts.isModuleDeclaration(stmt)) &&
    stmt.name &&
    ts.isIdentifier(stmt.name)
  ) {
    return [stmt.name.text];
  }
  return [];
}

/**
 * String values of an exported enum's members and of `const X = "…"`: keys
 * that SQL, configs or other languages use as literals.
 */
function stringKeys(stmt: ts.Statement): string[] {
  if (ts.isEnumDeclaration(stmt)) {
    return stmt.members.flatMap((m) =>
      m.initializer && ts.isStringLiteralLike(m.initializer)
        ? [m.initializer.text]
        : [],
    );
  }
  if (ts.isVariableStatement(stmt)) {
    return stmt.declarationList.declarations.flatMap((d) =>
      d.initializer && ts.isStringLiteralLike(d.initializer)
        ? [d.initializer.text]
        : [],
    );
  }
  return [];
}

const SIGNAL_INPUTS = new Set(["input", "output", "model"]);

/** The name a class member is bound by in templates, if it is an input or output. */
function bindingName(member: ts.ClassElement): string | undefined {
  if (
    !(
      ts.isPropertyDeclaration(member) || ts.isSetAccessorDeclaration(member)
    ) ||
    !ts.isIdentifier(member.name)
  ) {
    return undefined;
  }
  for (const d of ts.getDecorators(member) ?? []) {
    const e = d.expression;
    if (
      ts.isCallExpression(e) &&
      ts.isIdentifier(e.expression) &&
      (e.expression.text === "Input" || e.expression.text === "Output")
    ) {
      // @Input("alias") binds by the alias.
      const [alias] = e.arguments;
      return alias && ts.isStringLiteralLike(alias)
        ? alias.text
        : member.name.text;
    }
  }
  // Signal inputs and outputs: input(), input.required(), output(), model().
  const init = ts.isPropertyDeclaration(member)
    ? member.initializer
    : undefined;
  if (init && ts.isCallExpression(init)) {
    const callee = init.expression;
    const fn = ts.isPropertyAccessExpression(callee)
      ? callee.expression
      : callee;
    if (ts.isIdentifier(fn) && SIGNAL_INPUTS.has(fn.text)) {
      return member.name.text;
    }
  }
  return undefined;
}

/** Selectors a template uses the component by: `app-x`, `[appX]`, `app-x, [x]`. */
function selectorNames(selector: string): string[] {
  return selector
    .split(",")
    .map((s) => s.trim().replace(/^\[|\]$/g, ""))
    .filter((s) => /^[A-Za-z][\w-]*$/.test(s));
}

/**
 * Angular components and directives (`@Component`, `@Directive`):
 *  - the template and styles (`templateUrl`, `styleUrl(s)`) are parts of the
 *    component, read with it like an SQL include;
 *  - the selector, inputs and outputs are names templates use it by, so a
 *    template that binds `[showButton]` or `(clicked)` links to it.
 */
function angularDeclarations(
  sf: ts.SourceFile,
): { parts: ImportFact[]; names: string[] }[] {
  const FILE_KEYS = new Set(["templateUrl", "styleUrl", "styleUrls"]);
  const out: { parts: ImportFact[]; names: string[] }[] = [];
  for (const stmt of sf.statements) {
    if (!ts.isClassDeclaration(stmt)) {
      continue;
    }
    for (const d of ts.getDecorators(stmt) ?? []) {
      const call = d.expression;
      if (
        !ts.isCallExpression(call) ||
        !ts.isIdentifier(call.expression) ||
        (call.expression.text !== "Component" &&
          call.expression.text !== "Directive")
      ) {
        continue;
      }
      const parts: ImportFact[] = [];
      const names: string[] = [];
      const [config] = call.arguments;
      for (const prop of config && ts.isObjectLiteralExpression(config)
        ? config.properties
        : []) {
        if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) {
          continue;
        }
        const key = prop.name.text;
        if (key === "selector" && ts.isStringLiteralLike(prop.initializer)) {
          names.push(...selectorNames(prop.initializer.text));
        }
        if (!FILE_KEYS.has(key)) {
          continue;
        }
        const values = ts.isArrayLiteralExpression(prop.initializer)
          ? [...prop.initializer.elements]
          : [prop.initializer];
        for (const v of values) {
          if (ts.isStringLiteralLike(v)) {
            // Angular resolves these relative to the component, with or without "./".
            const specifier = v.text.startsWith(".") ? v.text : `./${v.text}`;
            parts.push({ specifier, names: "*", relation: "contains" });
          }
        }
      }
      for (const m of stmt.members) {
        const n = bindingName(m);
        if (n) {
          names.push(n);
        }
      }
      out.push({ parts, names });
    }
  }
  return out;
}

function collectDynamic(sf: ts.SourceFile, imports: ImportFact[]): void {
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const [arg] = node.arguments;
      const isImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire =
        ts.isIdentifier(node.expression) && node.expression.text === "require";
      if ((isImport || isRequire) && arg && ts.isStringLiteralLike(arg)) {
        imports.push({ specifier: arg.text, names: "*" });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

/** Matches a tsconfig `paths` pattern (at most one "*"); returns the "*" capture. */
function matchPattern(pattern: string, spec: string): string | undefined {
  const star = pattern.indexOf("*");
  if (star < 0) {
    return pattern === spec ? "" : undefined;
  }
  const pre = pattern.slice(0, star);
  const post = pattern.slice(star + 1);
  if (
    spec.length < pre.length + post.length ||
    !spec.startsWith(pre) ||
    !spec.endsWith(post)
  ) {
    return undefined;
  }
  return spec.slice(pre.length, spec.length - post.length);
}

const CONDITIONS = ["types", "import", "default", "bun", "node", "require"];

/**
 * Every target a conditional `exports` value names, preferred conditions first
 * (a target may point to a build output that isn't in the repository, so the
 * caller takes the first one that exists).
 */
function conditionTargets(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(conditionTargets);
  }
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const keys = [
      ...CONDITIONS.filter((c) => c in o),
      ...Object.keys(o).filter((k) => !CONDITIONS.includes(k)),
    ];
    return [...new Set(keys.flatMap((k) => conditionTargets(o[k])))];
  }
  return [];
}

/** Resolves a subpath ("." or "./x") through a package.json `exports` field. */
function exportTargets(exportsField: unknown, sub: string): string[] {
  if (exportsField === undefined) {
    return [];
  }
  if (typeof exportsField === "string" || Array.isArray(exportsField)) {
    return sub === "." ? conditionTargets(exportsField) : [];
  }
  const map = exportsField as Record<string, unknown>;
  const keys = Object.keys(map);
  if (!keys.some((k) => k.startsWith("."))) {
    return sub === "." ? conditionTargets(map) : [];
  }
  if (sub in map) {
    return conditionTargets(map[sub]);
  }
  for (const k of keys) {
    const m = matchPattern(k, sub);
    if (m !== undefined && k.includes("*")) {
      return conditionTargets(map[k]).map((t) => t.replace("*", m));
    }
  }
  return [];
}
