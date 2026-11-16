import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileStore } from "./file-store.ts";

describe("FileStore", () => {
  it("keeps one JSON file per key and misses unknown keys", async () => {
    const dir = join(mkdtempSync(join(tmpdir(), "ripple-store-")), "ai");
    const store = new FileStore(dir);
    expect(await store.get("nope")).toBeUndefined();
    await store.put("abc", { order: [1] });
    expect(await store.get("abc")).toEqual({ order: [1] });
    expect(readdirSync(dir)).toEqual(["abc.json"]);
  });
});
