// biome-ignore lint/style/noRestrictedImports: the reference the helper replaces
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "./sha256.ts";

describe("sha256Hex", () => {
  it("agrees with node:crypto, across block boundaries and UTF-8", () => {
    const inputs = [
      "",
      "abc",
      "src/a.ts",
      "x".repeat(55),
      "x".repeat(56),
      "x".repeat(64),
      "x".repeat(1000),
      "libs/über/straße.ts",
      "🙂 emoji path",
    ];
    for (const s of inputs) {
      expect(sha256Hex(s), s).toBe(
        createHash("sha256").update(s).digest("hex"),
      );
    }
  });
});
