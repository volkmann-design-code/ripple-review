import { GraphqlAdapter } from "@ripple-review/adapter-graphql";
import { SqlAdapter } from "@ripple-review/adapter-sql";
import { TypeScriptAdapter } from "@ripple-review/adapter-typescript";
import type { LanguageAdapter } from "@ripple-review/core/model";

/** All built-in adapters. Adding a language = implementing LanguageAdapter and listing it here. */
export function defaultAdapters(): LanguageAdapter[] {
  return [new TypeScriptAdapter(), new SqlAdapter(), new GraphqlAdapter()];
}
