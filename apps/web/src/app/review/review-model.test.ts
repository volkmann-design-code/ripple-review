import type { ReviewPayload } from "@ripple-review/api-contract";
import { describe, expect, it } from "vitest";
import { parseRef, parseRepo, routeOf } from "../core/refs.ts";
import { groupViews, tickedCount, ticksOf } from "./review-model.ts";

const review: ReviewPayload = {
  ref: { kind: "github", owner: "o", repo: "r", number: 1 },
  version: "v",
  ticks: [],
  groups: [
    {
      kind: "story",
      title: "Booking",
      purpose: "Books shipments.",
      items: [
        {
          path: "a.sql",
          role: "schema",
          additions: 3,
          deletions: 0,
          status: "added",
          notes: [],
        },
        {
          path: "b.ts",
          role: "source",
          additions: 1,
          deletions: 1,
          status: "modified",
          notes: ["uses x"],
        },
      ],
    },
    {
      kind: "generated",
      title: "Generated",
      items: [
        {
          path: "gen.ts",
          role: "generated",
          additions: 9,
          deletions: 0,
          status: "added",
          notes: [],
        },
      ],
    },
  ],
  files: {
    "a.sql": { status: "added", binary: false, hunks: [], patchHash: "h1" },
    "b.ts": { status: "modified", binary: false, hunks: [], patchHash: "h2" },
  },
};

describe("groupViews", () => {
  it("numbers files through the whole order and collapses generated groups", () => {
    const views = groupViews(review);
    expect(views.map((g) => [g.id, g.title, g.collapsed])).toEqual([
      ["group-1", "Booking", false],
      ["group-2", "Generated", true],
    ]);
    expect(views.flatMap((g) => g.files.map((f) => [f.n, f.path]))).toEqual([
      [1, "a.sql"],
      [2, "b.ts"],
      [3, "gen.ts"],
    ]);
    expect(views[0]?.purpose).toBe("Books shipments.");
    expect(views[1]?.files[0]?.diff).toBeUndefined();
  });
});

describe("ticks", () => {
  it("counts ticked files and saves them with their diff's hash", () => {
    const ticked = new Set(["b.ts", "gone.ts"]);
    expect(tickedCount(["a.sql", "b.ts"], ticked)).toBe(1);
    expect(ticksOf(ticked, review.files)).toEqual([
      { path: "b.ts", patchHash: "h2" },
    ]);
  });
});

describe("refs", () => {
  it("reads pull request URLs and short forms", () => {
    const pr = { kind: "github", owner: "acme", repo: "app", number: 12 };
    expect(parseRef("https://github.com/acme/app/pull/12/files")).toEqual(pr);
    expect(parseRef("acme/app#12")).toEqual(pr);
    expect(parseRef(" acme/app/pull/12 ")).toEqual(pr);
    expect(parseRef("fixture:ripple-review-3")).toBeUndefined();
    expect(parseRef("acme/app")).toBeUndefined();
    expect(parseRepo("https://github.com/acme/app.git")).toEqual({
      owner: "acme",
      repo: "app",
    });
  });

  it("maps a change to its route", () => {
    const pr = {
      kind: "github",
      owner: "acme",
      repo: "app",
      number: 12,
    } as const;
    expect(routeOf(pr)).toEqual(["/", "acme", "app", "pull", "12"]);
  });
});
