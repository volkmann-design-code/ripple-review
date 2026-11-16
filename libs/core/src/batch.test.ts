import { describe, expect, it } from "vitest";
import { batched } from "./batch.ts";

describe("batched", () => {
  it("loads keys asked for together in one call, and each key once", async () => {
    const calls: string[][] = [];
    const read = batched(async (keys) => {
      calls.push(keys);
      return new Map(
        keys.filter((k) => k !== "missing").map((k) => [k, k.toUpperCase()]),
      );
    });
    expect(await Promise.all([read("a"), read("b"), read("missing")])).toEqual([
      "A",
      "B",
      undefined,
    ]);
    expect(await read("a")).toBe("A");
    expect(await read("c")).toBe("C");
    expect(calls).toEqual([["a", "b", "missing"], ["c"]]);
  });

  it("rejects a failed batch and tries its keys again later", async () => {
    let fail = true;
    const read = batched(async (keys) => {
      if (fail) {
        throw new Error("offline");
      }
      return new Map(keys.map((k) => [k, 1]));
    });
    await expect(read("a")).rejects.toThrow("offline");
    fail = false;
    expect(await read("a")).toBe(1);
  });
});
