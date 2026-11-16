import type { ReviewGroup, ReviewItem, Role } from "@ripple-review/core/model";
import { describe, expect, it } from "vitest";
import { measure } from "./measures.ts";

const item = (path: string, role: Role = "source"): ReviewItem => ({
  path,
  role,
  additions: 1,
  deletions: 0,
  status: "modified",
  notes: [],
});

describe("measure", () => {
  it("counts structure over the reviewed files only", () => {
    const groups: ReviewGroup[] = [
      {
        kind: "context",
        title: "Context: read first",
        items: [item("README.md", "docs")],
      },
      {
        kind: "story",
        title: "Around a.ts",
        items: [item("a.ts"), item("b.ts"), item("a.test.ts", "test")],
      },
      {
        kind: "mechanical",
        title: "Same edit in 2 files",
        items: [item("c.ts"), item("d.test.ts", "test")],
      },
      {
        kind: "misc",
        title: "Standalone changes",
        section: "standalone",
        items: [item("e.ts"), item("e.test.ts", "test")],
      },
      {
        kind: "generated",
        title: "Generated",
        items: [item("bun.lock", "lockfile")],
      },
    ];
    const edges = [
      { from: "a.ts", to: "b.ts", kind: "import" as const, via: ["x"] },
      { from: "a.ts", to: "a.test.ts", kind: "import" as const, via: ["x"] },
    ];
    expect(measure(groups, edges)).toEqual({
      files: 9,
      groups: 5,
      stories: 1,
      standalone: 2 / 7,
      testsPlaced: 2 / 3,
      mechanical: 1,
      unlinked: 4 / 7,
    });
  });

  it("leaves the test share open when the change has no tests", () => {
    expect(measure([], []).testsPlaced).toBeUndefined();
  });
});
