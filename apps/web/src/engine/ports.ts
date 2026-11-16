import type { ChangeRef } from "@ripple-review/api-contract";
import type { Forge } from "@ripple-review/core/forge";
import type { ReviewPort } from "./drafts";
import type { ViewedPort } from "./viewed";

/*
 * A forge's optional capabilities, bound to one pull request, for the parts
 * of the engine that use them.
 */

/** The pull request's "Viewed" marks, the user's own, if the forge keeps them. */
export function viewedOn(forge: Forge, ref: ChangeRef): ViewedPort | undefined {
  const viewed = forge.viewed;
  if (!viewed) {
    return undefined;
  }
  const pull = pullOf(ref);
  return {
    forge: "GitHub",
    get: () => viewed.get(pull),
    set: (changes) => viewed.set(pull, changes),
  };
}

/** The pull request's reviews: the threads and the user's pending review, if the forge has them. */
export function reviewsOn(
  forge: Forge,
  ref: ChangeRef,
): ReviewPort | undefined {
  const reviews = forge.reviews;
  if (!reviews) {
    return undefined;
  }
  const pull = pullOf(ref);
  return {
    forge: "GitHub",
    features: reviews.features,
    threads: () => reviews.threads(pull),
    addDraft: (anchor, body) => reviews.addDraft(pull, anchor, body),
    editDraft: (id, body) => reviews.editDraft(pull, id, body),
    deleteDraft: (id) => reviews.deleteDraft(pull, id),
    submit: (event, body) => reviews.submit(pull, event, body),
  };
}

const pullOf = (ref: ChangeRef) => ({
  repo: `${ref.owner}/${ref.repo}`,
  number: ref.number,
});
