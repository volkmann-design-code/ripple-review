import type { StoredChange } from "@ripple-review/api-contract";
import { describe, expect, it } from "vitest";
import { lossesOf, metaOf, partsOf, unsentOf } from "./stored-change.ts";

const change = (extra: Partial<StoredChange> = {}): StoredChange => ({
  ref: { kind: "github", owner: "o", repo: "r", number: 7 },
  reviews: 0,
  ticks: 0,
  waitingDrafts: 0,
  summary: false,
  aiAnswers: 0,
  size: 0,
  ...extra,
});

describe("stored change", () => {
  it("says what is kept", () => {
    expect(partsOf(change({ reviews: 2, ticks: 1, aiAnswers: 3 }))).toBe(
      "2 saved reviews · 1 tick · 3 AI answers",
    );
    expect(partsOf(change())).toBe("");
  });

  it("names the reference only below a title", () => {
    expect(metaOf(change())).toBe("");
    expect(metaOf(change({ title: "Fix" }))).toBe("o/r#7");
  });

  it("says what only this browser has", () => {
    expect(
      unsentOf(change({ summary: true, waitingDrafts: 2 }), "GitHub"),
    ).toBe("a review summary and 2 draft changes not on GitHub yet");
  });

  it("asks before losing drafts or paid answers, not for the rest", () => {
    expect(
      lossesOf(change({ reviews: 3, ticks: 4 }), "GitHub"),
    ).toBeUndefined();
    expect(lossesOf(change({ aiAnswers: 1, summary: true }), "GitHub")).toBe(
      "a review summary and the AI's answer (asking again is billed to your key)",
    );
  });
});
