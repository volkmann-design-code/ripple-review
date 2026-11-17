import { adapterContext, MemorySnapshot } from "@ripple-review/core/snapshot";
import { adapterContract } from "@ripple-review/core/testing/adapter-contract";
import { describe, expect, it } from "vitest";
import { TypeScriptAdapter } from "./typescript.ts";

const files: Record<string, string> = {
  "tsconfig.json": JSON.stringify({
    compilerOptions: {
      baseUrl: ".",
      paths: {
        "@app/*": ["libs/*/src/index.ts"],
        "@shared/utils/*": ["libs/utils/src/*"],
        "~config": ["config/index.ts"],
      },
    },
  }),
  // A nested tsconfig wins for files below it.
  "apps/web/tsconfig.json": `{
    // comments are allowed
    "compilerOptions": { "paths": { "@app/*": ["./src/app/*"] } }
  }`,
  "apps/web/src/app/auth.ts": "export const auth = 1;",
  "apps/web/src/main.ts": 'import { auth } from "@app/auth";',
  "libs/auth/src/index.ts": 'export * from "./session.js";',
  "libs/auth/src/session.ts": "export class Session {}",
  "libs/utils/src/strings.ts": "export const trim = (s: string) => s.trim();",
  "libs/utils/src/dates/index.ts": "export const today = () => new Date();",
  "config/index.ts": "export default {};",
  "libs/db/package.json": JSON.stringify({
    name: "@acme/db",
    exports: {
      ".": { types: "./src/index.d.ts", import: "./src/index.ts" },
      "./schema/*": { default: "./src/schema/*.ts" },
      "./client": ["./src/client.ts"],
    },
  }),
  "libs/db/src/index.ts": "export const db = 1;",
  "libs/db/src/schema/users.ts": "export const users = 1;",
  "libs/db/src/client.ts": "export const client = 1;",
  "libs/legacy/package.json": JSON.stringify({
    name: "@acme/legacy",
    main: "lib/main.js",
  }),
  "libs/legacy/lib/main.ts": "export const legacy = 1;",
  "libs/plain/package.json": JSON.stringify({ name: "@acme/plain" }),
  "libs/plain/src/index.ts": "export const plain = 1;",
  "libs/plain/src/extra.tsx": "export const Extra = () => null;",
  "node_modules/left-pad/package.json": JSON.stringify({ name: "left-pad" }),
  "src/app.ts": [
    'import def, { a, b as c } from "./lib/mod.js";',
    'import type { T } from "./lib/types";',
    'import * as ns from "./lib";',
    'import "./side-effect.mjs";',
    'export { x } from "./lib/mod";',
    'export * from "./lib/all";',
    'export * as grouped from "./lib/grouped";',
    "export { def as renamed, ns, local };",
    "const local = 1;",
    "export function f() {}",
    "export class K {}",
    "export interface I {}",
    "export type U = string;",
    "export enum E { A }",
    "export const v1 = 1, v2 = 2;",
    "export default f;",
    'const lazy = () => import("./lazy");',
    'const req = require("./cjs.cjs");',
  ].join("\n"),
  "src/lib/mod.ts": "export default 1; export const a = 1, b = 2, x = 3;",
  "src/lib/types.ts": "export type T = number;",
  "src/lib/index.ts": "export const n = 1;",
  "src/lib/all.ts": "export const all = 1;",
  "src/lib/grouped.ts": "export const g = 1;",
  "src/side-effect.mts": "console.log(1);",
  "src/lazy.tsx": "export default () => null;",
  "src/cjs.cts": "module.exports = {};",
};

// One initialised adapter for all tests (top-level await: init reads files).
const initialised = new TypeScriptAdapter();
await initialised.init(await adapterContext(new MemorySnapshot(files)));

function adapter(): TypeScriptAdapter {
  return initialised;
}

describe("TypeScriptAdapter.parse", () => {
  const facts = adapter().parse("src/app.ts", files["src/app.ts"]!);

  it("collects imports with their names", () => {
    expect(facts.imports).toEqual([
      {
        specifier: "./lib/mod.js",
        names: ["default", "a", "b"],
        typeOnly: false,
      },
      { specifier: "./lib/types", names: ["T"], typeOnly: true },
      { specifier: "./lib", names: "*", typeOnly: false },
      { specifier: "./side-effect.mjs", names: "*" },
      { specifier: "./lib/grouped", names: "*" },
      { specifier: "./lazy", names: "*" },
      { specifier: "./cjs.cjs", names: "*" },
    ]);
  });

  it("collects re-exports, including exported imports", () => {
    expect(facts.reexports).toEqual([
      { specifier: "./lib/mod", names: [{ from: "x", as: "x" }] },
      { specifier: "./lib/all", names: "*" },
      {
        specifier: "./lib/mod.js",
        names: [{ from: "default", as: "renamed" }],
      },
    ]);
  });

  it("collects what the file defines and exports", () => {
    expect(facts.exports.sort()).toEqual(
      [
        "E",
        "I",
        "K",
        "U",
        "default",
        "f",
        "grouped",
        "local",
        "ns",
        "v1",
        "v2",
      ].sort(),
    );
    expect(facts.definitions).not.toContain("default");
    expect(facts.definitions).toContain("v2");
  });

  it("defines the string values of exported enums and constants as keys", () => {
    const facts = adapter().parse(
      "src/settings.ts",
      [
        "export enum Settings {",
        "  REWARD_AMOUNT = 'referral_reward_amount',",
        "  LIMIT = 3,",
        "}",
        'export const WRITE = "referrals:write";',
        'const LOCAL = "not_exported_key";',
      ].join("\n"),
    );
    expect(facts.definitions).toEqual([
      "Settings",
      "WRITE",
      "referral_reward_amount",
      "referrals:write",
    ]);
  });

  it("parses TSX and JS", () => {
    const a = adapter();
    expect(
      a.parse("x.tsx", "export const C = () => <div>{1}</div>;").exports,
    ).toEqual(["C"]);
    expect(
      a.parse("x.js", 'const m = require("./m"); module.exports = m;').imports,
    ).toEqual([{ specifier: "./m", names: "*" }]);
  });
});

describe("TypeScriptAdapter.resolve", () => {
  it.each([
    // relative, with extension probing, .js → .ts, directory index
    ["src/app.ts", "./lib/mod.js", "src/lib/mod.ts"],
    ["src/app.ts", "./lib/types", "src/lib/types.ts"],
    ["src/app.ts", "./lib", "src/lib/index.ts"],
    ["src/app.ts", "./side-effect.mjs", "src/side-effect.mts"],
    ["src/app.ts", "./lazy", "src/lazy.tsx"],
    ["src/app.ts", "./cjs.cjs", "src/cjs.cts"],
    ["src/lib/mod.ts", "../app", "src/app.ts"],
    // tsconfig paths: wildcard, exact, nested tsconfig first
    ["src/app.ts", "@app/auth", "libs/auth/src/index.ts"],
    ["apps/web/src/main.ts", "@app/auth", "apps/web/src/app/auth.ts"],
    ["src/app.ts", "@shared/utils/strings", "libs/utils/src/strings.ts"],
    ["src/app.ts", "@shared/utils/dates", "libs/utils/src/dates/index.ts"],
    ["src/app.ts", "~config", "config/index.ts"],
    // workspace packages: exports conditions, wildcards, arrays, main, src fallback
    ["src/app.ts", "@acme/db", "libs/db/src/index.ts"],
    ["src/app.ts", "@acme/db/schema/users", "libs/db/src/schema/users.ts"],
    ["src/app.ts", "@acme/db/client", "libs/db/src/client.ts"],
    ["src/app.ts", "@acme/legacy", "libs/legacy/lib/main.ts"],
    ["src/app.ts", "@acme/plain", "libs/plain/src/index.ts"],
    ["src/app.ts", "@acme/plain/extra", "libs/plain/src/extra.tsx"],
  ])("from %s: %s → %s", (from, spec, to) => {
    expect(adapter().resolve(spec, from)).toBe(to);
  });

  it.each([
    ["src/app.ts", "react"],
    ["src/app.ts", "left-pad"],
    ["src/app.ts", "./missing"],
    ["src/app.ts", "../../outside"],
    ["src/app.ts", "@acme/db/not-exported"],
    ["src/app.ts", "@acme/dbx"],
  ])("from %s: %s → undefined", (from, spec) => {
    expect(adapter().resolve(spec, from)).toBeUndefined();
  });
});

adapterContract(() => new TypeScriptAdapter(), {
  files,
  supported: [
    "src/app.ts",
    "src/lazy.tsx",
    "src/cjs.cts",
    "src/side-effect.mts",
  ],
  unsupported: ["README.md", "schema.sql", "package.json", "types.graphql"],
  resolves: [
    { from: "src/app.ts", specifier: "./lib", to: "src/lib/index.ts" },
  ],
  unresolved: [{ from: "src/app.ts", specifier: "react" }],
});
