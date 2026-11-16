import type { ChangeSet, ReviewGroup } from "../model.ts";
import { filesWithDiff, MAX_TOTAL_LINES, trimmedDiff } from "./excerpts.ts";
import type { AiTool } from "./port.ts";

/** read_diff: lines per file, calls. */
const READ_FILE_LINES = 200;
const MAX_READS = 3;

/** read_diff: the full hunks of the files asked for, within a budget. */
export function readDiffTool(
  cs: ChangeSet,
  groups: ReviewGroup[],
): AiTool & {
  reads: string[];
} {
  const allowed = new Set(filesWithDiff(groups).map((i) => i.path));
  const reads: string[] = [];
  let calls = 0;
  let left = MAX_TOTAL_LINES;
  return {
    name: "read_diff",
    description:
      "Returns the diff of the given changed files (up to 200 lines each). Generated files and repeated mechanical edits are not available.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["paths"],
      properties: {
        paths: {
          type: "array",
          items: { type: "string" },
          description: "Exact paths from the groups.",
        },
      },
    },
    reads,
    run(input) {
      const paths =
        typeof input === "object" &&
        input !== null &&
        Array.isArray((input as { paths?: unknown }).paths)
          ? ((input as { paths: unknown[] }).paths.filter(
              (p) => typeof p === "string",
            ) as string[])
          : [];
      if (++calls > MAX_READS || left <= 0) {
        return "The reading budget is used up. Answer with what you know.";
      }
      const out: string[] = [];
      for (const p of paths) {
        if (!allowed.has(p)) {
          out.push(
            `### ${p}`,
            "(not available: unknown, generated or a repeated mechanical edit)",
          );
          continue;
        }
        if (left <= 0) {
          out.push(`### ${p}`, "(not read: the reading budget is used up)");
          continue;
        }
        const max = Math.min(READ_FILE_LINES, left);
        const diff = trimmedDiff(cs, p, max);
        left -= Math.min(max, diff.split("\n").length);
        reads.push(p);
        out.push(`### ${p}`, "```diff", diff, "```");
      }
      return out.join("\n") || "No paths given.";
    },
  };
}
