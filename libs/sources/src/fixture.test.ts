import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MemorySnapshot } from "@ripple-review/core/snapshot";
import { afterEach, describe, expect, it } from "vitest";
import { loadFixture, recordFixture } from "./fixture.ts";

const patch = [
  "diff --git a/src/a.ts b/src/a.ts",
  "--- a/src/a.ts",
  "+++ b/src/a.ts",
  "@@ -1 +1 @@",
  "-export const a = 1;",
  "+export const a = 2;",
  "",
].join("\n");

let dir: string;
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("recordFixture / loadFixture", () => {
  it("round-trips the change, keeping only the files read", async () => {
    dir = mkdtempSync(join(tmpdir(), "ripple-fixture-"));
    const head = new MemorySnapshot({
      "src/a.ts": "export const a = 2;",
      "src/unread.ts": "export const u = 1;",
    });
    const { cs, save } = recordFixture({
      title: "a title",
      url: "https://github.com/o/r/pull/7",
      head,
      files: [],
      patch,
    });
    expect(await cs.head.read("src/a.ts")).toBe("export const a = 2;");
    await save(dir);

    const loaded = loadFixture(dir);
    expect(loaded.title).toBe("a title");
    expect(loaded.patch).toBe(patch);
    expect(loaded.files.map((f) => [f.path, f.additions, f.deletions])).toEqual(
      [["src/a.ts", 1, 1]],
    );
    expect(await loaded.head.list()).toEqual(["src/a.ts", "src/unread.ts"]);
    expect(await loaded.head.read("src/a.ts")).toBe("export const a = 2;");
    expect(await loaded.head.read("src/unread.ts")).toBeUndefined();
    expect(loaded.fileLink?.("src/a.ts")).toMatch(
      /^https:\/\/github\.com\/o\/r\/pull\/7\/files#diff-[0-9a-f]{64}$/,
    );
  });

  it("needs the diff text", () => {
    expect(() =>
      recordFixture({ head: new MemorySnapshot({}), files: [] }),
    ).toThrow(/no diff text/);
  });
});
