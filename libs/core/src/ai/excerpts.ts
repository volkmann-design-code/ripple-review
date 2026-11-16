import type { ChangeSet, ReviewGroup, ReviewItem } from "../model.ts";

/** Diff lines shown per file, and in all (full input, and read_diff's budget). */
export const MAX_FILE_LINES = 80;
export const MIN_FILE_LINES = 12;
export const MAX_TOTAL_LINES = 6000;

/** A file's hunks, cut to `max` lines. */
export function trimmedDiff(cs: ChangeSet, path: string, max: number): string {
  const file = cs.files.find((f) => f.path === path);
  if (!file || file.binary) {
    return "(binary)";
  }
  const lines = file.hunks.flatMap((h) => [
    `@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@`,
    ...h.lines,
  ]);
  return lines.length > max
    ? [...lines.slice(0, max), `… ${lines.length - max} more lines`].join("\n")
    : lines.join("\n");
}

export const changedLinesOf = (cs: ChangeSet, path: string) =>
  (cs.files.find((f) => f.path === path)?.hunks ?? [])
    .flatMap((h) => h.lines)
    .filter((l) => l[0] === "+" || l[0] === "-");

/** Files whose diff the model sees: not generated, one per mechanical group. */
export function filesWithDiff(groups: ReviewGroup[]): ReviewItem[] {
  return groups.flatMap((g) =>
    g.kind === "generated"
      ? []
      : g.kind === "mechanical"
        ? g.items.slice(0, 1)
        : g.items,
  );
}
