import type {
  ChangeRef,
  CommentAnchor,
  FileLines,
  Forgettable,
  PullRequestSummary,
  RecentChange,
  ReviewDrafts,
  ReviewEvent,
  ReviewPayload,
  SavedProgress,
  StoredData,
  Tick,
} from "@ripple-review/api-contract";

/*
 * The engine as the page sees it: types (and the database's name) only, so
 * the page's bundle doesn't pull in the engine, which runs in the worker
 * (`engine.worker.ts`).
 */

/** The IndexedDB database the engine keeps everything in. */
export const DB_NAME = "ripple-review";

/** What the user gives the app (settings page); kept in their browser only. */
export interface Settings {
  githubToken?: string;
  anthropicKey?: string;
}

/**
 * What the page asks the engine: `Backend` does it in the worker, and the
 * page's `EngineService` forwards each call there.
 */
export interface EngineApi {
  configure(settings: Settings): Promise<void>;
  review(
    ref: ChangeRef,
    ai: boolean | undefined,
    onStage: (stage: string) => void,
  ): Promise<ReviewPayload>;
  fileLines(ref: ChangeRef, path: string): Promise<FileLines>;
  saveProgress(ref: ChangeRef, ticks: Tick[]): Promise<SavedProgress>;
  /** The reviewer's pending review and the change's threads; undefined: the forge has no reviews. */
  drafts(ref: ChangeRef): Promise<ReviewDrafts | undefined>;
  addDraft(
    ref: ChangeRef,
    anchor: CommentAnchor,
    body: string,
  ): Promise<ReviewDrafts>;
  editDraft(ref: ChangeRef, id: string, body: string): Promise<ReviewDrafts>;
  deleteDraft(ref: ChangeRef, id: string): Promise<ReviewDrafts>;
  /** Keeps the summary in this browser until the review is submitted. */
  saveSummary(ref: ChangeRef, body: string): Promise<void>;
  submitReview(
    ref: ChangeRef,
    event: ReviewEvent,
    body: string,
  ): Promise<ReviewDrafts>;
  pulls(owner: string, repo: string): Promise<PullRequestSummary[]>;
  /** The changes opened in this browser, most recent first. */
  recent(): Promise<RecentChange[]>;
  /** What the engine keeps in this browser, by change. */
  stored(): Promise<StoredData>;
  /** Deletes one group of what `stored` lists. */
  forget(what: Forgettable): Promise<void>;
}
