/*
 * What the engine (in the web app's worker, `apps/web/src/engine/`) gives
 * the page. Types only: the page imports this without pulling in the engine.
 */
import type { AiUsage, AiWeakEdge } from "@ripple-review/core/ai/port";
import type {
  CommentAnchor,
  DiffSide,
  ReviewComment,
  ReviewEvent,
  ReviewThread,
} from "@ripple-review/core/forge";
import type { FileStatus, Hunk, ReviewGroup } from "@ripple-review/core/model";

export type {
  AiUsage,
  AiWeakEdge,
  CommentAnchor,
  DiffSide,
  FileStatus,
  Hunk,
  ReviewComment,
  ReviewEvent,
  ReviewGroup,
  ReviewThread,
};

/** Which change a review is of: a pull request on a forge (GitHub so far). */
export type ChangeRef = {
  kind: "github";
  owner: string;
  repo: string;
  number: number;
};

export interface FileDiff {
  status: FileStatus;
  oldPath?: string;
  binary: boolean;
  hunks: Hunk[];
  /** Hash of the file's diff: a tick stays only while this is unchanged. */
  patchHash: string;
  /** The file in the change's web view (GitHub's "Files changed"), if any. */
  link?: string;
}

export interface ReviewPayload {
  ref: ChangeRef;
  /** The files the reviewer ticked whose diff is still the same. */
  ticks: Tick[];
  title?: string;
  url?: string;
  /** Hash of the whole diff: the same diff gives the same review. */
  version: string;
  groups: ReviewGroup[];
  files: Record<string, FileDiff>;
  /**
   * Set when the review was read from this device's storage instead of
   * computed: the diff is the same as when it was saved.
   */
  restored?: { savedAt: string };
  /** For a change on a forge with "Viewed" marks: whether the ticks are them. */
  viewedSync?: ViewedSync;
  ai?: {
    model: string;
    /** Missing when the answer was saved on this device (no new cost). */
    usage?: AiUsage;
    weakEdges: AiWeakEdge[];
    reads: string[];
  };
}

export interface Tick {
  path: string;
  patchHash: string;
}

/**
 * Whether what the reviewer did reached the forge. Ticks are the forge's
 * "Viewed" marks where it has them (GitHub), draft comments its pending
 * review: read when a review loads, written as the reviewer goes. When that
 * fails, they stay in the browser and are sent on the next try.
 */
export interface ForgeSync {
  /** The forge's name for the user, e.g. "GitHub". */
  forge: string;
  /** false: the last read or write failed; `error` and `hint` say why. */
  synced: boolean;
  error?: string;
  hint?: string;
  /** The HTTP-like status of the failure (403: the token may not write). */
  status?: number;
}

export type ViewedSync = ForgeSync;

/** A tick or untick not yet sent to the forge. */
export interface PendingMark extends Tick {
  viewed: boolean;
}

/** What the reviewer did with a change: ticks, and whether they wanted the AI order. */
export interface Progress {
  ticks: Tick[];
  /** Ticks and unticks the forge hasn't got yet (it refused, or was unreachable). */
  pending?: PendingMark[];
  ai?: boolean;
  updatedAt?: string;
}

/** The progress after saving ticks, and whether the forge got them. */
export interface SavedProgress extends Progress {
  viewedSync?: ViewedSync;
}

/** A changed file at head, to expand the unchanged lines around its hunks. */
export interface FileLines {
  path: string;
  lines: string[];
}

export interface PullRequestSummary {
  number: number;
  title: string;
  author: string;
  updatedAt: string;
  url: string;
  draft: boolean;
  /** Branches, for stacks: a pull request whose base is another's head sits on it. */
  head?: string;
  base?: string;
  defaultBranch?: string;
  /** The head branch is in a fork: nothing can sit on it. */
  fromFork?: boolean;
}

/** A change opened in this browser, for "Recently viewed". */
export interface RecentChange {
  ref: ChangeRef;
  title?: string;
  url?: string;
  openedAt: string;
  /** Changed files, and how many of them are ticked. */
  files: number;
  ticked: number;
}

/** What this browser keeps for one change (settings page). */
export interface StoredChange {
  ref: ChangeRef;
  title?: string;
  openedAt?: string;
  /** Reviews saved: static and AI-refined, per diff. */
  reviews: number;
  ticks: number;
  /** Draft comments the forge hasn't taken yet: only here. */
  waitingDrafts: number;
  /** An unsubmitted review summary. */
  summary: boolean;
  aiAnswers: number;
  /** About the characters kept. */
  size: number;
}

/** Everything the engine keeps in this browser, grouped for the settings page. */
export interface StoredData {
  changes: StoredChange[];
  /** AI answers not tied to a change (kept before the app tracked that). */
  otherAiAnswers: { count: number; size: number };
  /** File contents by blob, shared by all changes of a repository. */
  files: { count: number; size: number };
}

/** What the settings page can delete on its own. */
export type Forgettable =
  | { kind: "change"; ref: ChangeRef }
  | { kind: "other-ai-answers" }
  | { kind: "files" };

export interface ApiError {
  error: string;
  /** What the user can do about it, if anything. */
  hint?: string;
}

/** A comment in the reviewer's pending review. */
export interface DraftComment {
  id: string;
  anchor: CommentAnchor;
  body: string;
  /** Not on the forge yet: kept in this browser and sent on the next try. */
  local?: boolean;
}

/**
 * The review the reviewer is writing on a forge that has reviews, and the
 * threads already on the change.
 */
export interface ReviewDrafts {
  /** The forge's name for the user, e.g. "GitHub". */
  forge: string;
  /** Whether comments can span lines, and be on a whole file. */
  ranges: boolean;
  fileComments: boolean;
  /** How the review can be submitted (on the reviewer's own change: as a comment only). */
  events: ReviewEvent[];
  /** Threads already on the change; the reviewer's own pending replies are marked pending. */
  threads: ReviewThread[];
  drafts: DraftComment[];
  /** The summary, kept in this browser until it is submitted. */
  summary: string;
  sync: ForgeSync;
}
