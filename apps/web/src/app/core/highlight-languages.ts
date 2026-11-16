import type { LanguageInput } from "shiki/core";

/** Shiki languages by file extension (loaded on first use). */
export const LANGS: Record<string, () => Promise<{ default: LanguageInput }>> =
  {
    ts: () => import("shiki/langs/typescript.mjs"),
    mts: () => import("shiki/langs/typescript.mjs"),
    cts: () => import("shiki/langs/typescript.mjs"),
    tsx: () => import("shiki/langs/tsx.mjs"),
    js: () => import("shiki/langs/javascript.mjs"),
    mjs: () => import("shiki/langs/javascript.mjs"),
    cjs: () => import("shiki/langs/javascript.mjs"),
    jsx: () => import("shiki/langs/jsx.mjs"),
    json: () => import("shiki/langs/json.mjs"),
    html: () => import("shiki/langs/angular-html.mjs"),
    css: () => import("shiki/langs/css.mjs"),
    scss: () => import("shiki/langs/scss.mjs"),
    sql: () => import("shiki/langs/sql.mjs"),
    graphql: () => import("shiki/langs/graphql.mjs"),
    gql: () => import("shiki/langs/graphql.mjs"),
    md: () => import("shiki/langs/markdown.mjs"),
    yaml: () => import("shiki/langs/yaml.mjs"),
    yml: () => import("shiki/langs/yaml.mjs"),
    sh: () => import("shiki/langs/shellscript.mjs"),
    php: () => import("shiki/langs/php.mjs"),
    dart: () => import("shiki/langs/dart.mjs"),
    py: () => import("shiki/langs/python.mjs"),
    go: () => import("shiki/langs/go.mjs"),
    toml: () => import("shiki/langs/toml.mjs"),
  };
