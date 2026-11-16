import { describe, expect, it } from "vitest";
import { generatorMatcher, generatorOutputs } from "./generators.ts";
import { MemorySnapshot } from "./snapshot.ts";

const outputs = async (files: Record<string, string>) =>
  (await generatorOutputs(new MemorySnapshot(files)))
    .map((o) => (o.dir ? `${o.path}/` : o.path))
    .sort();

describe("generatorOutputs", () => {
  it("reads graphql-codegen's generates keys in YAML", async () => {
    expect(
      await outputs({
        "packages/database/codegen.yml": [
          "overwrite: true",
          "schema: './src/schema.graphql'",
          "generates:",
          "  ./src/schema.ts:",
          "    config:",
          "      enumsAsConst: true",
          "    plugins:",
          "      - 'typescript'",
          "  ./src/graphql.schema.json:",
          "    plugins:",
          "      - 'introspection'",
          "hooks: {}",
        ].join("\n"),
      }),
    ).toEqual([
      "packages/database/src/graphql.schema.json",
      "packages/database/src/schema.ts",
    ]);
  });

  it("reads graphql-codegen's generates keys in TS, directories included", async () => {
    expect(
      await outputs({
        "apps/web/codegen.ts": [
          "const config: CodegenConfig = {",
          '  schema: "../../libs/graphql/src/generated/schema.graphql",',
          "  generates: {",
          '    "src/gql/": {',
          '      preset: "client",',
          '      config: { scalars: { "Date": "string" } },',
          "    },",
          "    './src/types.ts': { plugins: ['typescript'] },",
          "  },",
          "};",
        ].join("\n"),
      }),
    ).toEqual(["apps/web/src/gql/", "apps/web/src/types.ts"]);
  });

  it("reads Prisma, buf, sqlc, Orval and PostGraphile outputs", async () => {
    expect(
      await outputs({
        "db/schema.prisma":
          'generator client {\n  provider = "prisma-client-js"\n  output   = "../src/generated/prisma"\n}',
        "proto/buf.gen.yaml":
          "version: v2\nplugins:\n  - remote: buf.build/protocolbuffers/go\n    out: gen/go",
        "sqlc.yaml":
          'version: "2"\nsql:\n  - engine: postgresql\n    gen:\n      go:\n        out: "internal/db"',
        "web/orval.config.ts":
          "export default { api: { input: { target: './spec.yaml' }, output: { target: './src/api.ts', schemas: './src/model' } } };",
        "api/.postgraphilerc.js":
          "module.exports = { options: { exportGqlSchemaPath: 'schema.graphql' } };",
      }),
    ).toEqual([
      "api/schema.graphql",
      "internal/db/",
      "proto/gen/go/",
      "src/generated/prisma/",
      "web/src/api.ts",
      "web/src/model/",
    ]);
  });

  it("leaves out globs, URLs and outputs that would cover the config's own tree", async () => {
    expect(
      await outputs({
        "buf.gen.yaml": "plugins:\n  - out: .",
        "x/codegen.yml":
          // biome-ignore lint/suspicious/noTemplateCurlyInString: an interpolated path in a config
          "generates:\n  ./src/${NAME}.ts:\n    plugins: []\n  https://x.de/a.ts:\n    plugins: []",
      }),
    ).toEqual([]);
  });
});

describe("generatorMatcher", () => {
  it("matches output files and everything under output directories", async () => {
    const isGenerated = await generatorMatcher(
      new MemorySnapshot({
        "apps/web/codegen.ts":
          'export default { generates: { "src/gql/": {} } };',
      }),
    );
    expect(isGenerated("apps/web/src/gql/graphql.ts")).toBe(true);
    expect(isGenerated("apps/web/src/gqlx.ts")).toBe(false);
    expect(isGenerated("apps/web/src/app.ts")).toBe(false);
  });
});
