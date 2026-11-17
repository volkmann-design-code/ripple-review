import { adapterContext, MemorySnapshot } from "@ripple-review/core/snapshot";
import { describe, expect, it } from "vitest";
import { GraphileMigrate } from "./graphile-migrate.ts";

const files: Record<string, string> = {
  "libs/db/.gmrc": "{}",
  "libs/db/migrations/current.sql": [
    "--! include functions/get_user.sql",
    "--! include functions/missing.sql",
    "alter table app.users add column last_seen timestamptz;",
  ].join("\n"),
  "libs/db/migrations/committed/000001.sql": [
    "--! Previous: sha1:abc",
    "--! Hash: sha1:def",
    "",
    "--! Included functions/get_user.sql",
    "create or replace function app.get_user_by_email(email text)",
    "returns app.users as $$ select 1 $$ language sql;",
    "--! EndIncluded functions/get_user.sql",
  ].join("\n"),
  "libs/db/migrations/fixtures/functions/get_user.sql":
    "create or replace function app.get_user_by_email(email text) …",
  "seeds/users.sql": "--! include functions/get_user.sql",
};

async function rule(paths: Record<string, string> = files) {
  const r = new GraphileMigrate();
  const found = await r.detect(await adapterContext(new MemorySnapshot(paths)));
  return { r, found };
}

describe("GraphileMigrate", () => {
  it("is detected by a .gmrc with a migrations folder", async () => {
    expect((await rule()).found).toBe(true);
    const { "libs/db/.gmrc": _, ...withoutGmrc } = files;
    expect((await rule(withoutGmrc)).found).toBe(false);
  });

  it("reads includes in the current migration and expanded ones in committed migrations", async () => {
    const { r } = await rule();
    for (const path of [
      "libs/db/migrations/current.sql",
      "libs/db/migrations/committed/000001.sql",
    ]) {
      expect(r.file({ path, content: files[path] })).toEqual({
        parts: ["libs/db/migrations/fixtures/functions/get_user.sql"],
      });
    }
  });

  it("ignores SQL outside the migrations folder", async () => {
    const { r } = await rule();
    expect(
      r.file({ path: "seeds/users.sql", content: files["seeds/users.sql"] }),
    ).toBeUndefined();
  });
});
