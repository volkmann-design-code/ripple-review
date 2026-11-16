import { describe, expect, it } from "vitest";
import {
  type DiffRow,
  diffRows,
  EXPAND_STEP,
  reveal,
  runs,
} from "./diff-rows.ts";

// A 60-line file; hunk 1 changes line 10, hunk 2 adds a line after 40.
const file = Array.from({ length: 60 }, (_, i) => `line ${i + 1}`);
const hunks = [
  {
    oldStart: 9,
    oldLines: 3,
    newStart: 9,
    newLines: 3,
    lines: [" line 9", "-old 10", "+line 10", " line 11"],
  },
  {
    oldStart: 40,
    oldLines: 2,
    newStart: 40,
    newLines: 3,
    lines: [" line 40", "+line 41", " line 42"],
  },
];

const summary = (rows: DiffRow[]) =>
  rows.map((r) =>
    r.kind === "gap"
      ? `gap${r.gap}:${r.hidden ?? "?"}${r.down ? "↓" : ""}${r.up ? "↑" : ""}`
      : `${r.kind}:${r.oldNo ?? ""}/${r.newNo ?? ""}`,
  );

describe("diffRows", () => {
  it("numbers lines and puts gaps around the hunks", () => {
    expect(summary(diffRows(hunks, file))).toEqual([
      "gap0:8↑",
      "ctx:9/9",
      "del:10/",
      "add:/10",
      "ctx:11/11",
      "gap1:28↓↑",
      "ctx:40/40",
      "add:/41",
      "ctx:41/42",
      "gap2:18↓",
    ]);
  });

  it("shows a gap after the last hunk before the file's length is known", () => {
    const rows = diffRows(hunks);
    expect(summary(rows).at(-1)).toBe("gap2:?↓");
    expect(summary(rows)[5]).toBe("gap1:28↓↑");
  });

  it("reveals lines from either side of a gap, with matching old numbers", () => {
    let r = reveal({}, 1, "down");
    r = reveal(r, 1, "up");
    const rows = diffRows(hunks, file, r);
    const gap1 = rows.filter(
      (x) => x.kind === "ctx" && (x.newNo ?? 0) > 11 && (x.newNo ?? 0) < 40,
    );
    expect(gap1).toHaveLength(Math.min(28, 2 * EXPAND_STEP));
    expect(summary(rows)).not.toContain("gap1:28↓↑");
    // After hunk 2 the new file is one line longer: old = new - 1.
    const after = diffRows(hunks, file, reveal({}, 2, "all")).at(-1);
    expect(after).toEqual({
      kind: "ctx",
      oldNo: 59,
      newNo: 60,
      text: "line 60",
    });
  });

  it("opens a whole gap at once", () => {
    const rows = diffRows(hunks, file, reveal({}, 0, "all"));
    expect(summary(rows).slice(0, 2)).toEqual(["ctx:1/1", "ctx:2/2"]);
    expect(summary(rows)).not.toContain("gap0:8↑");
  });
});

describe("runs", () => {
  it("splits each side into contiguous lines for highlighting", () => {
    const rows = diffRows(hunks, file);
    expect(runs(rows, "new")).toEqual([
      { start: 9, text: ["line 9", "line 10", "line 11"] },
      { start: 40, text: ["line 40", "line 41", "line 42"] },
    ]);
    expect(runs(rows, "old")).toEqual([
      { start: 9, text: ["line 9", "old 10", "line 11"] },
      { start: 40, text: ["line 40", "line 42"] },
    ]);
  });
});
