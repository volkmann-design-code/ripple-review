import type { PullRequestSummary } from "@ripple-review/api-contract";
import { describe, expect, it } from "vitest";
import { buildStacks, stackOf } from "./stacks.ts";

const pr = (
  number: number,
  head: string,
  base: string,
  updatedAt = "2026-11-01T00:00:00Z",
  extra: Partial<PullRequestSummary> = {},
): PullRequestSummary => ({
  number,
  title: `PR ${number}`,
  author: "a",
  updatedAt,
  url: `https://github.com/o/r/pull/${number}`,
  draft: false,
  head,
  base,
  defaultBranch: "main",
  ...extra,
});

const shape = (prs: PullRequestSummary[]) =>
  buildStacks(prs).map((s) =>
    s.rows.map((r) => ({
      n: r.pr.number,
      depth: r.depth,
      rails: r.rails,
      last: r.last,
      kids: r.hasChildren,
      orphan: r.orphan,
    })),
  );

describe("buildStacks", () => {
  it("puts a pull request on the one whose head is its base", () => {
    expect(
      shape([
        pr(3, "c", "b"),
        pr(1, "a", "main"),
        pr(2, "b", "a"),
        pr(4, "d", "a"),
        pr(5, "e", "b"),
      ]),
    ).toEqual([
      [
        { n: 1, depth: 0, rails: [], last: true, kids: true, orphan: false },
        { n: 2, depth: 1, rails: [], last: false, kids: true, orphan: false },
        {
          n: 3,
          depth: 2,
          rails: [true],
          last: false,
          kids: false,
          orphan: false,
        },
        {
          n: 5,
          depth: 2,
          rails: [true],
          last: true,
          kids: false,
          orphan: false,
        },
        { n: 4, depth: 1, rails: [], last: true, kids: false, orphan: false },
      ],
    ]);
  });

  it("orders stacks by their latest update and marks a missing base", () => {
    expect(
      shape([
        pr(1, "a", "main", "2026-11-01T00:00:00Z"),
        pr(2, "b", "merged-branch", "2026-11-02T00:00:00Z"),
        pr(3, "c", "a", "2026-11-03T00:00:00Z"),
      ]).map((s) => s.map((r) => [r.n, r.orphan])),
    ).toEqual([
      [
        [1, false],
        [3, false],
      ],
      [[2, true]],
    ]);
  });

  it("puts nothing on a fork's branch, nor without branches", () => {
    const fork = pr(1, "feature", "main", undefined, { fromFork: true });
    const onIt = pr(2, "x", "feature");
    const bare: PullRequestSummary = {
      number: 3,
      title: "",
      author: "",
      updatedAt: "",
      url: "",
      draft: false,
    };
    expect(shape([fork, onIt, bare]).map((s) => s.map((r) => r.n))).toEqual([
      [1],
      [2],
      [3],
    ]);
  });

  it("finds the stack of a pull request with others in it", () => {
    const stacks = buildStacks([
      pr(1, "a", "main"),
      pr(2, "b", "a"),
      pr(3, "c", "main"),
    ]);
    expect(stackOf(stacks, 2)?.rows.map((r) => r.pr.number)).toEqual([1, 2]);
    expect(stackOf(stacks, 3)).toBeUndefined();
    expect(stackOf(stacks, 9)).toBeUndefined();
  });
});
