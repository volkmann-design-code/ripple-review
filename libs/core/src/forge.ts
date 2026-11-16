import type { ChangeSet } from "./model.ts";

/*
 * Where changes come from in the app and the CLI: a forge (GitHub, GitLab,
 * a self-hosted instance) behind its API, with the user's own token (D22).
 * One adapter per forge in `libs/forge-<name>`. What forges offer beyond
 * reading a change is an optional capability on `Forge` (`viewed`,
 * `reviews`), and a capability says what of it the forge supports: the app
 * offers it where the forge has it.
 */

/** A change on one forge: the repository's path there and the number. */
export interface ForgeChangeRef {
  /** `owner/repo` on GitHub; `group/subgroup/project` on GitLab. */
  repo: string;
  number: number;
}

/** An open change, as listed for a repository. */
export interface ChangeSummary {
  number: number;
  title: string;
  url: string;
  author?: string;
  updatedAt?: string;
  draft?: boolean;
  /** The branch with the changes, and the one it is to be merged into. */
  head?: string;
  base?: string;
  /** The repository's default branch: a change on any other base is stacked. */
  defaultBranch?: string;
  /** The head branch is in another repository (a fork): no change sits on it. */
  fromFork?: boolean;
}

export interface LoadOptions {
  /** Reports what loading is doing, for progress shown to the user. */
  stage?: (message: string) => void;
  /** The last load of the same change: reused if base and head are the same. */
  previous?: ChangeSet;
}

/**
 * The user's own "viewed" mark on a file of a change. "dismissed": marked
 * viewed, but the file changed since (GitHub unmarks it then).
 */
export type ViewedState = "viewed" | "unviewed" | "dismissed";

export interface ViewedChange {
  path: string;
  viewed: boolean;
}

/** A forge's per-file "viewed" marks (GitHub's "Viewed" checkbox). */
export interface ViewedMarks {
  /** The mark of every file of the change. */
  get(ref: ForgeChangeRef): Promise<Map<string, ViewedState>>;
  /**
   * Marks or unmarks files. Paths no longer in the change are skipped; a
   * token that may not do it fails with a `ForgeError` of status 403.
   */
  set(ref: ForgeChangeRef, changes: ViewedChange[]): Promise<void>;
}

/** The side of a diff a line is on: "old" (deleted lines) or "new". */
export type DiffSide = "old" | "new";

/** Where a review comment is: a line or a range of lines, or a whole file. */
export interface CommentAnchor {
  path: string;
  /** The (last) line; none: the comment is on the whole file. */
  line?: number;
  side?: DiffSide;
  /** A range's first line, when it is more than one. */
  startLine?: number;
  startSide?: DiffSide;
}

export interface ReviewComment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  url?: string;
  /** In the user's pending review: only they see it until they submit. */
  pending: boolean;
}

/** A conversation on a line, a range or a file of a change. */
export interface ReviewThread {
  id: string;
  /** Where it is in the current diff; `line` is where it was when outdated. */
  anchor: CommentAnchor;
  /** The lines changed since: it no longer sits on the current diff. */
  outdated: boolean;
  resolved: boolean;
  comments: ReviewComment[];
}

/** How a review is submitted. */
export type ReviewEvent = "comment" | "approve" | "request-changes";

/** What a forge's reviews can do. */
export interface ReviewFeatures {
  /** Comments on a range of lines, not only one. */
  ranges: boolean;
  /** Comments on a whole file. */
  fileComments: boolean;
  events: readonly ReviewEvent[];
}

/**
 * Reviews on a forge (GitHub's pull request reviews): the threads, and the
 * user's own pending review, whose draft comments only they see until they
 * submit it. Tokens that may not write fail with a `ForgeError` of 403.
 */
export interface ForgeReviews {
  readonly features: ReviewFeatures;
  /** Every thread of the change, the user's drafts included (pending comments). */
  threads(
    ref: ForgeChangeRef,
  ): Promise<{ threads: ReviewThread[]; ownChange: boolean }>;
  /** Adds a draft comment to the user's pending review, starting one if needed. */
  addDraft(
    ref: ForgeChangeRef,
    anchor: CommentAnchor,
    body: string,
  ): Promise<ReviewThread>;
  editDraft(
    ref: ForgeChangeRef,
    commentId: string,
    body: string,
  ): Promise<void>;
  /** Deletes a draft comment; one already gone counts as deleted. */
  deleteDraft(ref: ForgeChangeRef, commentId: string): Promise<void>;
  /** Submits the pending review with a summary (without drafts: the summary alone). */
  submit(ref: ForgeChangeRef, event: ReviewEvent, body: string): Promise<void>;
}

export interface Forge {
  /** "github", "gitlab", … */
  readonly id: string;
  /** The web host, e.g. "github.com" or a self-hosted instance's. */
  readonly host: string;
  /** A change from what a user pastes (URL or shorthand); undefined if not this forge's. */
  parseChange(input: string): ForgeChangeRef | undefined;
  /** A repository's open changes, most recently updated first. */
  listChanges(repo: string): Promise<ChangeSummary[]>;
  /** The change with its diff and a snapshot of head read through the API. */
  loadChange(ref: ForgeChangeRef, options?: LoadOptions): Promise<ChangeSet>;
  /** Per-file "viewed" marks, if the forge keeps them. */
  readonly viewed?: ViewedMarks;
  /** Review threads and the user's pending review, if the forge has them. */
  readonly reviews?: ForgeReviews;
}

/** A failed forge call, with an HTTP-like status and a hint for the user. */
export class ForgeError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly hint?: string,
  ) {
    super(message);
    this.name = "ForgeError";
  }
}
