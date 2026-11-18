import type {
  FrameworkFacts,
  FrameworkFile,
  FrameworkRule,
} from "@ripple-review/core/framework";
import type { AdapterContext } from "@ripple-review/core/model";
import { dirOf, joinRepo } from "@ripple-review/core/paths";
import ts from "typescript";
import { packagesUsing } from "../manifests.ts";

/** Component options naming files the component is made of. */
const FILE_KEYS = new Set(["templateUrl", "styleUrl", "styleUrls"]);
const DECORATORS = ["Component", "Directive", "Pipe"];
const SIGNAL_INPUTS = new Set(["input", "output", "model"]);

/**
 * Angular components, directives and pipes (`@Component`, `@Directive`,
 * `@Pipe`):
 *  - the template and styles (`templateUrl`, `styleUrl(s)`) are parts of the
 *    component, read right after it, the template first;
 *  - the selector, inputs and outputs are names templates use it by, so a
 *    template that binds `[showButton]` or `(clicked)` links to it;
 *  - a pipe's name is how templates use it: `{{ d | shortDate }}`.
 *
 * Detected by `@angular/core` in a `package.json` (the TypeScript adapter
 * reads them all, so recordings keep them).
 */
export class Angular implements FrameworkRule {
  readonly id = "angular";
  readonly name = "Angular";
  private paths: ReadonlySet<string> = new Set();

  async detect(ctx: AdapterContext): Promise<boolean> {
    this.paths = ctx.paths;
    return (await packagesUsing(ctx, "@angular/core")).length > 0;
  }

  file(f: FrameworkFile): FrameworkFacts | undefined {
    if (
      !/\.[cm]?tsx?$/.test(f.path) ||
      f.content === undefined ||
      !DECORATORS.some((d) => f.content?.includes(`@${d}`))
    ) {
      return undefined;
    }
    const sf = ts.createSourceFile(f.path, f.content, ts.ScriptTarget.Latest);
    const parts: string[] = [];
    const definitions: string[] = [];
    for (const c of declarations(sf)) {
      for (const spec of c.files) {
        const target = joinRepo(dirOf(f.path), spec);
        if (target && this.paths.has(target) && !parts.includes(target)) {
          parts.push(target);
        }
      }
      for (const n of c.names) {
        if (!definitions.includes(n)) {
          definitions.push(n);
        }
      }
    }
    return parts.length || definitions.length
      ? { parts, definitions }
      : undefined;
  }
}

/** Each component, directive or pipe: the files it is made of, the names templates use. */
function declarations(
  sf: ts.SourceFile,
): { files: string[]; names: string[] }[] {
  const out: { files: string[]; names: string[] }[] = [];
  for (const stmt of sf.statements) {
    if (!ts.isClassDeclaration(stmt)) {
      continue;
    }
    for (const d of ts.getDecorators(stmt) ?? []) {
      const call = d.expression;
      if (
        !ts.isCallExpression(call) ||
        !ts.isIdentifier(call.expression) ||
        !DECORATORS.includes(call.expression.text)
      ) {
        continue;
      }
      const files: string[] = [];
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
        if (
          key === "name" &&
          call.expression.text === "Pipe" &&
          ts.isStringLiteralLike(prop.initializer)
        ) {
          names.push(prop.initializer.text);
        }
        if (!FILE_KEYS.has(key)) {
          continue;
        }
        const values = ts.isArrayLiteralExpression(prop.initializer)
          ? [...prop.initializer.elements]
          : [prop.initializer];
        const specs = values.flatMap((v) =>
          // Angular resolves these relative to the component, with or without "./".
          ts.isStringLiteralLike(v)
            ? [v.text.startsWith(".") ? v.text : `./${v.text}`]
            : [],
        );
        // Read as component, template, styles, whatever order the decorator has.
        if (key === "templateUrl") {
          files.unshift(...specs);
        } else {
          files.push(...specs);
        }
      }
      for (const m of stmt.members) {
        const n = bindingName(m);
        if (n) {
          names.push(n);
        }
      }
      out.push({ files, names });
    }
  }
  return out;
}

/** Selectors a template uses the component by: `app-x`, `[appX]`, `app-x, [x]`. */
function selectorNames(selector: string): string[] {
  return selector
    .split(",")
    .map((s) => s.trim().replace(/^\[|\]$/g, ""))
    .filter((s) => /^[A-Za-z][\w-]*$/.test(s));
}

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
