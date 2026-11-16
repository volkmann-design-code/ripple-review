// biome-ignore lint/style/noRestrictedImports: the reference the helpers replace
import { posix } from "node:path";
import { describe, expect, it } from "vitest";
import { dirOf, joinRepo, normalizeRepoPath } from "./paths.ts";

// The functions replaced node:path's posix ones; they must agree with them.
const SAMPLES = [
  "",
  ".",
  "./",
  "a",
  "a/",
  "./a/b",
  "a//b",
  "a/./b",
  "a/../b",
  "a/b/../../c",
  "a/b/../..",
  "../a",
  "a/../../b",
  "/a/b",
  "/../a",
  "src/*",
  "libs/core/src/index.ts",
];

describe("paths", () => {
  it("normalizes like posix.normalize", () => {
    for (const p of SAMPLES) {
      const n = posix.normalize(p).replace(/^\.\//, "");
      const expected =
        n === ".." || n.startsWith("../") || n.startsWith("/") ? undefined : n;
      expect(normalizeRepoPath(p), p).toBe(expected);
    }
  });

  it("takes the directory like posix.dirname, with the root as empty", () => {
    for (const p of SAMPLES) {
      const d = posix.dirname(p);
      expect(dirOf(p), p).toBe(d === "." ? "" : d);
    }
  });

  it("joins like posix.join", () => {
    const pairs: string[][] = [
      ["", "."],
      ["libs/core", "./src"],
      ["libs/core", "../web/x.ts"],
      [".", "src/*"],
      ["a", "..", ".."],
      ["", ""],
    ];
    for (const parts of pairs) {
      expect(joinRepo(...parts), parts.join(" + ")).toBe(
        normalizeRepoPath(posix.join(...parts.filter((p) => p !== ""))),
      );
    }
  });
});
