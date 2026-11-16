import type { Hunk } from "@ripple-review/api-contract";

/*
 * The rows of a file's diff, with GitHub-style expansion: the unchanged lines
 * between hunks are hidden behind a gap row, and each gap can be opened from
 * its top (below the previous hunk), from its bottom (above the next hunk),
 * or entirely. Plain functions, tested without a browser.
 */

export type LineRow = {
  kind: "add" | "del" | "ctx";
  oldNo?: number;
  newNo?: number;
  text: string;
  /** The hunk the line is in; none for lines opened from a gap (not part of the diff). */
  hunk?: number;
};

export interface GapRow {
  kind: "gap";
  /** 0: before the first hunk; i: between hunk i-1 and i; n: after the last. */
  gap: number;
  /** Hidden lines; undefined when the file's length isn't known yet. */
  hidden?: number;
  /** The next hunk's header, as GitHub shows it in the gap. */
  header?: string;
  /** Which way it can open: "down" below the previous hunk, "up" above the next. */
  down: boolean;
  up: boolean;
}

export type DiffRow = LineRow | GapRow;

/** Lines revealed per gap, from its top and from its bottom. */
export type Revealed = Record<number, { top: number; bottom: number }>;

/** Lines one click reveals, as on GitHub. */
export const EXPAND_STEP = 20;

const lastNew = (h: Hunk) =>
  h.newLines === 0 ? h.newStart : h.newStart + h.newLines - 1;
const lastOld = (h: Hunk) =>
  h.oldLines === 0 ? h.oldStart : h.oldStart + h.oldLines - 1;

function hunkRows(h: Hunk, hunk: number): LineRow[] {
  const rows: LineRow[] = [];
  let oldNo = h.oldStart;
  let newNo = h.newStart;
  for (const line of h.lines) {
    const text = line.slice(1);
    if (line[0] === "+") {
      rows.push({ kind: "add", newNo: newNo++, text, hunk });
    } else if (line[0] === "-") {
      rows.push({ kind: "del", oldNo: oldNo++, text, hunk });
    } else {
      rows.push({ kind: "ctx", oldNo: oldNo++, newNo: newNo++, text, hunk });
    }
  }
  return rows;
}

/**
 * The rows to show. `lines` is the file at head (1-based line n is
 * `lines[n-1]`); without it, gaps show but can't open yet.
 */
export function diffRows(
  hunks: Hunk[],
  lines?: readonly string[],
  revealed: Revealed = {},
): DiffRow[] {
  const rows: DiffRow[] = [];
  if (hunks.length === 0) {
    return rows;
  }
  for (let i = 0; i <= hunks.length; i++) {
    const prev = hunks[i - 1];
    const next = hunks[i];
    const from = prev ? lastNew(prev) + 1 : 1;
    const to = next ? next.newStart - 1 : lines ? lines.length : undefined;
    // Unchanged lines have the same offset between old and new numbers.
    const offset = prev
      ? lastOld(prev) - lastNew(prev)
      : next
        ? next.oldStart - next.newStart
        : 0;
    const size = to === undefined ? undefined : Math.max(0, to - from + 1);
    const r = revealed[i] ?? { top: 0, bottom: 0 };
    const context = (n: number): LineRow => ({
      kind: "ctx",
      oldNo: n + offset,
      newNo: n,
      text: lines?.[n - 1] ?? "",
    });

    if (size === undefined) {
      // After the last hunk, length unknown: offer to open downwards.
      rows.push({ kind: "gap", gap: i, down: true, up: false });
    } else if (size > 0) {
      const top = lines ? Math.min(r.top, size) : 0;
      const bottom = lines ? Math.min(r.bottom, size - top) : 0;
      for (let n = from; n < from + top; n++) {
        rows.push(context(n));
      }
      const hidden = size - top - bottom;
      if (hidden > 0) {
        rows.push({
          kind: "gap",
          gap: i,
          hidden,
          ...(next ? { header: header(next) } : {}),
          down: prev !== undefined,
          up: next !== undefined,
        });
      }
      for (let n = from + size - bottom; n <= (to ?? 0); n++) {
        rows.push(context(n));
      }
    }
    if (next) {
      rows.push(...hunkRows(next, i));
    }
  }
  return rows;
}

function header(h: Hunk): string {
  return `@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@`;
}

/** Opens a gap by one step in a direction, or entirely. */
export function reveal(
  revealed: Revealed,
  gap: number,
  how: "up" | "down" | "all",
): Revealed {
  const r = revealed[gap] ?? { top: 0, bottom: 0 };
  const big = Number.MAX_SAFE_INTEGER;
  return {
    ...revealed,
    [gap]:
      how === "all"
        ? { top: big, bottom: 0 }
        : how === "down"
          ? { ...r, top: r.top + EXPAND_STEP }
          : { ...r, bottom: r.bottom + EXPAND_STEP },
  };
}

/**
 * Contiguous runs of one side's lines (new: context and additions; old:
 * context and deletions), so each run can be highlighted as one piece of code.
 */
export function runs(
  rows: readonly DiffRow[],
  side: "old" | "new",
): { start: number; text: string[] }[] {
  const out: { start: number; text: string[] }[] = [];
  let last: number | undefined;
  for (const row of rows) {
    if (row.kind === "gap") {
      last = undefined;
      continue;
    }
    const n = side === "new" ? row.newNo : row.oldNo;
    if (n === undefined) {
      continue;
    }
    const current = out.at(-1);
    if (current && last !== undefined && n === last + 1) {
      current.text.push(row.text);
    } else {
      out.push({ start: n, text: [row.text] });
    }
    last = n;
  }
  return out;
}
