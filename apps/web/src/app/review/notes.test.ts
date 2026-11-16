import type { Hunk, ReviewThread } from "@ripple-review/api-contract";
import { describe, expect, it } from "vitest";
import { diffRows } from "./diff-rows";
import {
  anchorLabel,
  anchorOf,
  composeAt,
  placeNotes,
  selectedRows,
} from "./notes";

// Old lines 1-4 → new: line 2 changed, a line added after 3.
const hunks: Hunk[] = [
  {
    oldStart: 1,
    oldLines: 4,
    newStart: 1,
    newLines: 5,
    lines: [" one", "-two", "+TWO", " three", "+added", " four"],
  },
  {
    oldStart: 20,
    oldLines: 1,
    newStart: 21,
    newLines: 1,
    lines: ["-x", "+y"],
  },
];
const rows = diffRows(hunks);
const rowOf = (kind: string, n: number) =>
  rows.findIndex(
    (r) => r.kind === kind && (kind === "del" ? r.oldNo === n : r.newNo === n),
  );

const thread = (
  id: string,
  anchor: ReviewThread["anchor"],
  outdated = false,
): ReviewThread => ({
  id,
  anchor,
  outdated,
  resolved: false,
  comments: [],
});

describe("placing comments on a diff", () => {
  it("puts threads and drafts after the row of their last line", () => {
    const { at, file } = placeNotes(
      rows,
      [
        thread("new", { path: "f", line: 2, side: "new" }),
        thread("old", { path: "f", line: 2, side: "old" }),
        thread("ctx-old", { path: "f", line: 3, side: "old" }),
        thread("file", { path: "f" }),
        thread("gone", { path: "f", line: 2, side: "new" }, true),
        thread("not shown", { path: "f", line: 12, side: "new" }),
      ],
      [
        {
          id: "d",
          anchor: {
            path: "f",
            line: 5,
            side: "new",
            startLine: 3,
            startSide: "new",
          },
          body: "",
        },
      ],
    );
    expect(at.get(rowOf("add", 2))?.threads.map((t) => t.id)).toEqual(["new"]);
    expect(at.get(rowOf("del", 2))?.threads.map((t) => t.id)).toEqual(["old"]);
    // A context line is on both sides.
    expect(at.get(rowOf("ctx", 3))?.threads.map((t) => t.id)).toEqual([
      "ctx-old",
    ]);
    expect(at.get(rowOf("ctx", 5))?.drafts.map((d) => d.id)).toEqual(["d"]);
    expect(file.threads.map((t) => t.id)).toEqual([
      "file",
      "gone",
      "not shown",
    ]);
  });

  it("composes a line, then a range with shift within a hunk", () => {
    const one = composeAt(rows, "f", rowOf("ctx", 5), false);
    expect(one).toEqual({
      path: "f",
      start: { side: "new", line: 5 },
      end: { side: "new", line: 5 },
      hunk: 0,
    });
    // Shift-click above: the range runs from there down.
    const range = composeAt(rows, "f", rowOf("del", 2), true, one);
    expect(anchorOf(range ?? { path: "f" })).toEqual({
      path: "f",
      startLine: 2,
      startSide: "old",
      line: 5,
      side: "new",
    });
    expect(selectedRows(rows, range)).toEqual({
      from: rowOf("del", 2),
      to: rowOf("ctx", 5),
    });
    expect(placeNotes(rows, [], [], range).at.get(rowOf("ctx", 5))?.form).toBe(
      true,
    );
    // Not across hunks: a new single line instead.
    const other = composeAt(rows, "f", rowOf("add", 21), true, range);
    expect(other?.start).toEqual({ side: "new", line: 21 });
    expect(other?.end).toEqual({ side: "new", line: 21 });
  });

  it("doesn't comment on lines opened from a gap (GitHub takes only the diff's)", () => {
    const lines = Array.from({ length: 25 }, (_, i) => `l${i + 1}`);
    const open = diffRows(hunks, lines, { 1: { top: 20, bottom: 0 } });
    const revealed = open.findIndex((r) => r.kind === "ctx" && r.newNo === 7);
    expect(composeAt(open, "f", revealed, false)).toBeUndefined();
  });

  it("labels anchors", () => {
    expect(anchorLabel({ path: "f" })).toBe("the file");
    expect(anchorLabel({ path: "f", line: 3, side: "new" })).toBe("line 3");
    expect(anchorLabel({ path: "f", line: 3, side: "old" })).toBe(
      "line 3 (old)",
    );
    expect(
      anchorLabel({
        path: "f",
        startLine: 2,
        startSide: "old",
        line: 4,
        side: "new",
      }),
    ).toBe("lines 2 (old)–4");
  });
});
