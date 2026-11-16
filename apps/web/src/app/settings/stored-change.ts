import type { StoredChange } from "@ripple-review/api-contract";
import { ago, count } from "../core/format";
import { labelOf } from "../core/refs";

/*
 * What Settings says about a pull request kept in this browser. No Angular
 * here, so it can be tested plainly.
 */

/** Its reference (below a title) and when it was opened. */
export function metaOf(c: StoredChange): string {
  return [
    c.title ? labelOf(c.ref) : "",
    c.openedAt ? `opened ${ago(c.openedAt)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** What is kept of it, in a line. */
export function partsOf(c: StoredChange): string {
  return [
    c.reviews ? count(c.reviews, "saved review") : "",
    c.ticks ? count(c.ticks, "tick") : "",
    c.aiAnswers ? count(c.aiAnswers, "AI answer") : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** What only this browser has: a summary, drafts the forge hasn't taken. */
export function unsentOf(c: StoredChange, forge: string): string {
  return [
    c.summary ? "a review summary" : "",
    c.waitingDrafts
      ? `${count(c.waitingDrafts, "draft change")} not on ${forge} yet`
      : "",
  ]
    .filter(Boolean)
    .join(" and ");
}

/** What deleting it loses that can't simply be fetched again, if anything. */
export function lossesOf(c: StoredChange, forge: string): string | undefined {
  const loses = [
    c.waitingDrafts || c.summary ? unsentOf(c, forge) : "",
    c.aiAnswers
      ? `the AI's ${c.aiAnswers === 1 ? "answer" : "answers"} (asking again is billed to your key)`
      : "",
  ].filter(Boolean);
  return loses.length ? loses.join(" and ") : undefined;
}
