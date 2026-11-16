import { adapterContext, MemorySnapshot } from "@ripple-review/core/snapshot";
import { adapterContract } from "@ripple-review/core/testing/adapter-contract";
import { describe, expect, it } from "vitest";
import { GraphqlAdapter } from "./graphql.ts";

const files: Record<string, string> = {
  "schema/user.graphql": [
    '#import "./common.graphql"',
    "type User implements Node {",
    "  id: ID!",
    "}",
    "extend type Query { me: User }",
    "input UserFilter { name: String }",
    "enum Role { ADMIN }",
    "interface Node { id: ID! }",
    "union SearchResult = User",
    "scalar DateTime",
    "directive @auth on FIELD_DEFINITION",
  ].join("\n"),
  "schema/common.graphql": "scalar Cursor",
  "client/me.gql":
    "#import '../schema/missing.graphql'\nquery Me { me { id } }",
};

// One initialised adapter for all tests (top-level await: init reads files).
const initialised = new GraphqlAdapter();
await initialised.init(await adapterContext(new MemorySnapshot(files)));

function adapter(): GraphqlAdapter {
  return initialised;
}

describe("GraphqlAdapter", () => {
  it("defines its types, inputs, enums, scalars and directives", () => {
    expect(
      adapter().parse("schema/user.graphql", files["schema/user.graphql"]!)
        .definitions,
    ).toEqual([
      "User",
      "Query",
      "UserFilter",
      "Role",
      "Node",
      "SearchResult",
      "DateTime",
      "auth",
    ]);
  });

  it("reads #import comments", () => {
    const a = adapter();
    expect(a.parse("client/me.gql", files["client/me.gql"]!).imports).toEqual([
      { specifier: "../schema/missing.graphql", names: "*" },
    ]);
    expect(a.resolve("./common.graphql", "schema/user.graphql")).toBe(
      "schema/common.graphql",
    );
  });
});

adapterContract(() => new GraphqlAdapter(), {
  files,
  supported: ["schema/user.graphql", "client/me.gql", "x.graphqls"],
  unsupported: ["schema.ts", "graphql.md"],
  resolves: [
    {
      from: "schema/user.graphql",
      specifier: "./common.graphql",
      to: "schema/common.graphql",
    },
  ],
  unresolved: [
    { from: "client/me.gql", specifier: "../schema/missing.graphql" },
  ],
});
