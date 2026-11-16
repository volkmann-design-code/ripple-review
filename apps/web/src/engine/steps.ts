// Types only: the engine is loaded on the first review.
import type { ReviewStep } from "@ripple-review/engine/review";

const count = (n: number) => n.toLocaleString("en");

/** What a step of the analysis is doing, in words for the progress line. */
export function stepMessage(s: ReviewStep, files: number): string {
  switch (s.step) {
    case "setup":
      return "Reading the repository's file list and config";
    case "read":
      // Reads from an API arrive in batches: no "0 of 75" while the first waits.
      return s.done
        ? `Reading the changed files: ${count(s.done)} of ${count(s.total)}`
        : `Reading the ${count(s.total)} changed files`;
    case "follow":
      return s.files
        ? `Following imports through unchanged files: ${count(s.files)} read`
        : "Following imports through unchanged files";
    case "link":
      return "Linking the changed files";
    case "order":
      return `Ordering ${count(files)} files into groups`;
  }
}

/**
 * Passes each new step on at once, and counts within a step at most every
 * `ms` (and the last one): a review reads a thousand files, the page needs
 * a few updates.
 */
export function throttled(
  send: (message: string) => void,
  ms = 150,
): (kind: string, message: string, last?: boolean) => void {
  let kind = "";
  let last = 0;
  return (k, message, final = false) => {
    const now = Date.now();
    if (k !== kind || final || now - last >= ms) {
      kind = k;
      last = now;
      send(message);
    }
  };
}
