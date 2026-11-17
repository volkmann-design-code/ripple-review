import { GraphqlAdapter } from "@ripple-review/adapter-graphql";
import { SqlAdapter } from "@ripple-review/adapter-sql";
import { TypeScriptAdapter } from "@ripple-review/adapter-typescript";
import type { FrameworkRule } from "@ripple-review/core/framework";
import type { LanguageAdapter } from "@ripple-review/core/model";
import { frameworkRules } from "@ripple-review/frameworks";

/** All built-in adapters. Adding a language = implementing LanguageAdapter and listing it here. */
export function defaultAdapters(): LanguageAdapter[] {
  return [new TypeScriptAdapter(), new SqlAdapter(), new GraphqlAdapter()];
}

/** All built-in framework rules (`libs/frameworks`); fresh ones per analysis. */
export function defaultFrameworks(): FrameworkRule[] {
  return frameworkRules();
}
