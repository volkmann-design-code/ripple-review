import type {
  PullRequestSummary,
  RecentChange,
} from "@ripple-review/api-contract";
import { describe, expect, it } from "vitest";
import { recentItems } from "./recent-items.ts";

const seen = (
  repo: string,
  number: number,
  openedAt: string,
): RecentChange => ({
  ref: { kind: "github", owner: "o", repo, number },
  openedAt,
  files: 3,
  ticked: 1,
});

const pr = (
  number: number,
  head: string,
  base: string,
): PullRequestSummary => ({
  number,
  title: `PR ${number}`,
  author: "a",
  updatedAt: "2026-11-01T00:00:00Z",
  url: "",
  draft: false,
  head,
  base,
  defaultBranch: "main",
});

const shape = (items: ReturnType<typeof recentItems>) =>
  items.map((i) =>
    i.stack ? i.stack.rows.map((r) => r.pr.number) : i.change.ref.number,
  );

describe("recentItems", () => {
  const recent = [
    seen("r", 2, "2026-11-16T12:00:00Z"),
    seen("other", 9, "2026-11-16T11:00:00Z"),
    seen("r", 1, "2026-11-16T10:00:00Z"),
    seen("r", 5, "2026-11-16T09:00:00Z"),
  ];

  it("shows a stack once, where its latest viewed one is", () => {
    const pulls = new Map([
      ["o/r", [pr(1, "a", "main"), pr(2, "b", "a"), pr(5, "e", "main")]],
    ]);
    const items = recentItems(recent, pulls);
    expect(shape(items)).toEqual([[1, 2], 9, 5]);
    expect(items[0]?.stack && items[0].openedAt).toBe("2026-11-16T12:00:00Z");
  });

  it("gives plain rows without a repository's pull requests", () => {
    expect(shape(recentItems(recent, new Map()))).toEqual([2, 9, 1, 5]);
  });
});
