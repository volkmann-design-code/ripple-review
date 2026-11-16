import { adapterContext, MemorySnapshot } from "@ripple-review/core/snapshot";
import { adapterContract } from "@ripple-review/core/testing/adapter-contract";
import { describe, expect, it } from "vitest";
import { SqlAdapter } from "./sql.ts";

const files: Record<string, string> = {
  "migrations/current.sql": [
    "--! include functions/get_user.sql",
    "\\ir ../seeds/users.sql",
    "alter table app.users add column if not exists last_seen timestamptz;",
  ].join("\n"),
  "migrations/fixtures/functions/get_user.sql": [
    'create or replace function app."get_user_by_email"(email text)',
    "returns app.users as $$ select 1 $$ language sql;",
  ].join("\n"),
  "seeds/users.sql": "insert into app.users values (1);",
  "db/schema.sql": [
    "CREATE TABLE IF NOT EXISTS public.organizations (id int);",
    "create materialized view org_stats as select 1;",
    "create type app.role as enum ('a');",
    "create unlogged table cache_entries ();",
    'ALTER TABLE organizations ADD COLUMN "billingEmail" text;',
  ].join("\n"),
};

// One initialised adapter for all tests (top-level await: init reads files).
const initialised = new SqlAdapter();
await initialised.init(await adapterContext(new MemorySnapshot(files)));

function adapter(): SqlAdapter {
  return initialised;
}

describe("SqlAdapter", () => {
  it("defines what a file creates and the columns it adds", () => {
    const a = adapter();
    expect(
      a.parse("db/schema.sql", files["db/schema.sql"]!).definitions,
    ).toEqual([
      "organizations",
      "org_stats",
      "role",
      "cache_entries",
      "billingEmail",
    ]);
    expect(
      a.parse("x.sql", files["migrations/fixtures/functions/get_user.sql"]!)
        .definitions,
    ).toEqual(["get_user_by_email"]);
  });

  it("reads includes as contains relations", () => {
    const facts = adapter().parse(
      "migrations/current.sql",
      files["migrations/current.sql"]!,
    );
    expect(facts.imports).toEqual([
      { specifier: "functions/get_user.sql", names: "*", relation: "contains" },
      { specifier: "../seeds/users.sql", names: "*", relation: "contains" },
    ]);
    expect(facts.definitions).toEqual(["last_seen"]);
  });

  it("resolves includes relative to the file, then by suffix", () => {
    const a = adapter();
    expect(a.resolve("../seeds/users.sql", "migrations/current.sql")).toBe(
      "seeds/users.sql",
    );
    expect(a.resolve("functions/get_user.sql", "migrations/current.sql")).toBe(
      "migrations/fixtures/functions/get_user.sql",
    );
    expect(a.resolve("nope.sql", "migrations/current.sql")).toBeUndefined();
  });

  it("hints migrations and schema files as schema", () => {
    const a = adapter();
    expect(a.roleHint("libs/db/migrations/committed/0001.sql")).toBe("schema");
    expect(a.roleHint("db/schema/users.sql")).toBe("schema");
    expect(a.roleHint("queries/report.sql")).toBeUndefined();
  });
});

adapterContract(() => new SqlAdapter(), {
  files,
  supported: ["migrations/current.sql", "db/schema.sql"],
  unsupported: ["schema.ts", "README.md", "sql/README"],
  resolves: [
    {
      from: "migrations/current.sql",
      specifier: "../seeds/users.sql",
      to: "seeds/users.sql",
    },
  ],
  unresolved: [{ from: "migrations/current.sql", specifier: "missing.sql" }],
});
