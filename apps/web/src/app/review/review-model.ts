import type {
  FileDiff,
  ReviewGroup,
  ReviewPayload,
  Tick,
} from "@ripple-review/api-contract";

/*
 * The review page's view model, computed from the engine's payload: plain
 * functions, tested without a browser.
 */

export interface FileView {
  path: string;
  /** Position in the whole reading order, from 1. */
  n: number;
  role: string;
  status: string;
  additions: number;
  deletions: number;
  notes: string[];
  diff?: FileDiff;
}

export interface GroupView {
  /** Anchor id on the page. */
  id: string;
  index: number;
  kind: ReviewGroup["kind"];
  title: string;
  purpose?: string;
  files: FileView[];
  /** Generated groups start collapsed; mechanical ones show one diff. */
  collapsed: boolean;
}

export function groupViews(review: ReviewPayload): GroupView[] {
  let n = 0;
  return review.groups.map((g, index) => ({
    id: `group-${index + 1}`,
    index,
    kind: g.kind,
    title: g.title,
    ...(g.purpose ? { purpose: g.purpose } : {}),
    collapsed: g.kind === "generated",
    files: g.items.map((it) => ({
      path: it.path,
      n: ++n,
      role: it.role,
      status: it.status,
      additions: it.additions,
      deletions: it.deletions,
      notes: it.notes,
      ...(review.files[it.path] ? { diff: review.files[it.path] } : {}),
    })),
  }));
}

/** Ticked paths among the given ones. */
export function tickedCount(
  paths: string[],
  ticked: ReadonlySet<string>,
): number {
  return paths.filter((p) => ticked.has(p)).length;
}

/** The ticks to save: one per ticked file, with its current diff's hash. */
export function ticksOf(
  ticked: ReadonlySet<string>,
  files: Record<string, FileDiff>,
): Tick[] {
  return [...ticked].flatMap((path) => {
    const f = files[path];
    return f ? [{ path, patchHash: f.patchHash }] : [];
  });
}

/** Generated and lock files are checked against their source, not read. */
export const isSkimmed = (g: GroupView) => g.kind === "generated";
