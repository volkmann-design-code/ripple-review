import type {
  CommentAnchor,
  DiffSide,
  DraftComment,
  ReviewThread,
} from "@ripple-review/api-contract";
import type { DiffRow, LineRow } from "./diff-rows";

/*
 * Where review comments go in a file's diff: threads and drafts after the
 * row of their (last) line, as on GitHub; comments on the whole file, on
 * lines not shown, or outdated ones above the diff. Plain functions, tested
 * without a browser.
 */

/** A line on one side of the diff. */
export interface LinePoint {
  side: DiffSide;
  line: number;
}

/** What the reviewer is writing a comment on: a file, or lines in one hunk of it. */
export interface Composing {
  path: string;
  start?: LinePoint;
  end?: LinePoint;
  hunk?: number;
}

/** The comments shown at one place of a file's diff. */
export interface Notes {
  threads: ReviewThread[];
  drafts: DraftComment[];
  /** The new comment's form goes here. */
  form: boolean;
}

export const emptyNotes = (): Notes => ({
  threads: [],
  drafts: [],
  form: false,
});

/** The point a row stands for: deleted lines on the old side, others on the new. */
export function pointOf(row: LineRow): LinePoint | undefined {
  if (row.kind === "del") {
    return row.oldNo === undefined
      ? undefined
      : { side: "old", line: row.oldNo };
  }
  return row.newNo === undefined ? undefined : { side: "new", line: row.newNo };
}

const key = (p: LinePoint) => `${p.side}:${p.line}`;

/** Row index by the points it shows (context lines are on both sides). */
function rowIndex(rows: readonly DiffRow[]): Map<string, number> {
  const at = new Map<string, number>();
  for (const [i, row] of rows.entries()) {
    if (row.kind === "gap") {
      continue;
    }
    if (row.newNo !== undefined && row.kind !== "del") {
      at.set(key({ side: "new", line: row.newNo }), i);
    }
    if (row.oldNo !== undefined && row.kind !== "add") {
      at.set(key({ side: "old", line: row.oldNo }), i);
    }
  }
  return at;
}

/** The anchor of a new comment from what is being composed. */
export function anchorOf(c: Composing): CommentAnchor {
  if (!c.end) {
    return { path: c.path };
  }
  const anchor: CommentAnchor = {
    path: c.path,
    line: c.end.line,
    side: c.end.side,
  };
  if (c.start && key(c.start) !== key(c.end)) {
    anchor.startLine = c.start.line;
    anchor.startSide = c.start.side;
  }
  return anchor;
}

/** "line 12", "lines 10–12", "the file". */
export function anchorLabel(a: CommentAnchor): string {
  if (a.line === undefined) {
    return "the file";
  }
  const side = (s?: DiffSide) => (s === "old" ? " (old)" : "");
  return a.startLine === undefined
    ? `line ${a.line}${side(a.side)}`
    : `lines ${a.startLine}${a.startSide !== a.side ? side(a.startSide) : ""}–${a.line}${side(a.side)}`;
}

/**
 * The comments of one file placed on the rows: by row index, and those
 * that go above the diff (`file`).
 */
export function placeNotes(
  rows: readonly DiffRow[],
  threads: readonly ReviewThread[],
  drafts: readonly DraftComment[],
  composing?: Composing,
): { at: Map<number, Notes>; file: Notes } {
  const index = rowIndex(rows);
  const at = new Map<number, Notes>();
  const file = emptyNotes();
  const notesFor = (anchor: CommentAnchor, outdated = false): Notes => {
    const i =
      anchor.line === undefined || outdated
        ? undefined
        : index.get(key({ side: anchor.side ?? "new", line: anchor.line }));
    if (i === undefined) {
      return file;
    }
    let notes = at.get(i);
    if (!notes) {
      notes = emptyNotes();
      at.set(i, notes);
    }
    return notes;
  };
  for (const t of threads) {
    notesFor(t.anchor, t.outdated).threads.push(t);
  }
  for (const d of drafts) {
    notesFor(d.anchor).drafts.push(d);
  }
  if (composing) {
    notesFor(anchorOf(composing)).form = true;
  }
  return { at, file };
}

/** The rows a comment being composed covers, to highlight them. */
export function selectedRows(
  rows: readonly DiffRow[],
  composing?: Composing,
): { from: number; to: number } | undefined {
  if (!composing?.end) {
    return undefined;
  }
  const index = rowIndex(rows);
  const to = index.get(key(composing.end));
  const from = composing.start ? index.get(key(composing.start)) : to;
  return from === undefined || to === undefined ? undefined : { from, to };
}

/**
 * The comment to compose after a click on a row's "+": that line, or with
 * shift held, the range from the line already chosen (in the same hunk; a
 * comment can't span hunks).
 */
export function composeAt(
  rows: readonly DiffRow[],
  path: string,
  row: number,
  extend: boolean,
  current?: Composing,
): Composing | undefined {
  const r = rows[row];
  if (!r || r.kind === "gap" || r.hunk === undefined) {
    return current;
  }
  const point = pointOf(r);
  if (!point) {
    return current;
  }
  const anchor = current?.start ?? current?.end;
  if (extend && current?.path === path && anchor && current.hunk === r.hunk) {
    const other = rowIndex(rows).get(key(anchor));
    if (other !== undefined) {
      return other <= row
        ? { path, start: anchor, end: point, hunk: r.hunk }
        : { path, start: point, end: anchor, hunk: r.hunk };
    }
  }
  return { path, start: point, end: point, hunk: r.hunk };
}
