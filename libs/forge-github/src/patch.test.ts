import { parseUnifiedDiff } from "@ripple-review/core/diff";
import { describe, expect, it } from "vitest";
import { patchFromFiles } from "./patch.ts";

describe("patchFromFiles", () => {
  it("rebuilds a diff the parser reads like GitHub's own", () => {
    const files = parseUnifiedDiff(
      patchFromFiles([
        { filename: "a.ts", status: "added", patch: "@@ -0,0 +1,2 @@\n+x\n+y" },
        { filename: "b.ts", status: "removed", patch: "@@ -1 +0,0 @@\n-z" },
        {
          filename: "new/c.ts",
          previous_filename: "old/c.ts",
          status: "renamed",
          patch: "@@ -1 +1 @@\n-p\n+q",
        },
        { filename: "big.json", status: "modified" },
      ]),
    );
    expect(
      files.map((f) => [f.path, f.oldPath, f.status, f.additions, f.deletions]),
    ).toEqual([
      ["a.ts", undefined, "added", 2, 0],
      ["b.ts", "b.ts", "removed", 0, 1],
      ["new/c.ts", "old/c.ts", "renamed", 1, 1],
      ["big.json", undefined, "modified", 0, 0],
    ]);
  });
});
