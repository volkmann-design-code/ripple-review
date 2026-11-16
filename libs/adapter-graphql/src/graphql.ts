import type {
  AdapterContext,
  ImportFact,
  LanguageAdapter,
  ModuleFacts,
  Role,
} from "@ripple-review/core/model";
import { dirOf, joinRepo } from "@ripple-review/core/paths";

const DEFINITION =
  /^\s*(?:extend\s+)?(?:type|input|enum|interface|union|scalar|directive\s+@)\s*(\w+)/gm;
const IMPORT = /^#\s*import\s+["'](.+?)["']/gm;

/** GraphQL SDL and operations: type definitions by name, `#import` comments. */
export class GraphqlAdapter implements LanguageAdapter {
  readonly id = "graphql";
  private paths: ReadonlySet<string> = new Set();

  supports(path: string): boolean {
    return /\.(graphql|gql|graphqls)$/.test(path);
  }

  init(ctx: AdapterContext): Promise<void> {
    this.paths = ctx.paths;
    return Promise.resolve();
  }

  parse(_path: string, content: string): ModuleFacts {
    const definitions = [
      ...new Set([...content.matchAll(DEFINITION)].map((m) => m[1]!)),
    ];
    const imports: ImportFact[] = [...content.matchAll(IMPORT)].map((m) => ({
      specifier: m[1]!,
      names: "*",
    }));
    return { imports, exports: definitions, reexports: [], definitions };
  }

  resolve(specifier: string, fromPath: string): string | undefined {
    const p = joinRepo(dirOf(fromPath), specifier);
    return p && this.paths.has(p) ? p : undefined;
  }

  roleHint(): Role | undefined {
    return "schema";
  }
}
