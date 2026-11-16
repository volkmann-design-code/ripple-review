/*
 * Reviews are saved on the device by change and diff, so a reload with the
 * same diff skips the analysis. A new engine may order the same diff
 * differently: bump `version` whenever the review's output changes, and the
 * reviews saved by older versions are no longer used.
 *
 * `goldens` is a hash of the recorded fixtures' expected orders: when they
 * change (an intended new order), `saved-reviews.test.ts` fails until the
 * version is bumped and the hash updated. Changes to how the AI's answer is
 * applied (`refine` in core) need a bump too; no golden covers them.
 */
export const SAVED_REVIEWS = {
  version: 1,
  goldens: "f95d6e7b1c9a1ce8",
} as const;
