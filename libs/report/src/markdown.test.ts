import type { ChangeSet, ReviewGroup } from "@ripple-review/core/model";
import { MemorySnapshot } from "@ripple-review/core/snapshot";
import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown.ts";

const groups: ReviewGroup[] = [
  {
    kind: "story",
    title: "Around `a.ts`",
    items: [
      {
        path: "src/a.ts",
        role: "source",
        additions: 3,
        deletions: 1,
        status: "added",
        notes: ["needed by 1 later file"],
      },
      {
        path: "src/a.test.ts",
        role: "test",
        additions: 2,
        deletions: 0,
        status: "modified",
        notes: [],
      },
    ],
  },
  {
    kind: "generated",
    title: "Generated",
    items: [
      {
        path: "gen/types.ts",
        role: "generated",
        additions: 10,
        deletions: 5,
        status: "removed",
        notes: ["ignored outside stories"],
      },
    ],
  },
];

describe("renderMarkdown", () => {
  it("renders groups as a numbered checklist", () => {
    const cs: ChangeSet = {
      title: "feat: x",
      url: "https://example.com/pr/1",
      fileLink: (p) => `https://example.com/pr/1#${p}`,
      head: new MemorySnapshot({}),
      files: [],
    };
    expect(renderMarkdown(cs, groups)).toBe(
      [
        "# Review order: feat: x",
        "https://example.com/pr/1",
        "",
        "3 files · +15 −6 · 2 groups · 15 changed lines are generated",
        "",
        "## 1. Around `a.ts`",
        "_2 files · +5 −1_",
        "",
        "1. [ ] [src/a.ts](https://example.com/pr/1#src/a.ts) (new) +3 −1 · needed by 1 later file",
        "2. [ ] [src/a.test.ts](https://example.com/pr/1#src/a.test.ts) +2 −0 · test",
        "",
        "## 2. Generated",
        "_1 files · +10 −5_",
        "",
        "3. [ ] [gen/types.ts](https://example.com/pr/1#gen/types.ts) (deleted) +10 −5 · generated",
        "",
      ].join("\n"),
    );
  });

  it("uses code spans without a file link", () => {
    const md = renderMarkdown(
      { head: new MemorySnapshot({}), files: [] },
      groups.slice(0, 1),
    );
    expect(md.split("\n")[0]).toBe("# Review order: change");
    expect(md).toContain("1. [ ] `src/a.ts` (new)");
  });
});
