import type { ChangedFile, Hunk } from "./model.ts";

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/** Parses `git diff` / GitHub unified diff output into per-file changes. */
export function parseUnifiedDiff(text: string): ChangedFile[] {
  const files: ChangedFile[] = [];
  let cur: ChangedFile | undefined;
  let hunk: Hunk | undefined;
  let oldLeft = 0;
  let newLeft = 0;

  for (const line of text.split("\n")) {
    if (line.startsWith("diff --git ")) {
      const m = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
      cur = {
        path: m?.[2] ?? line.slice(11),
        oldPath: m?.[1],
        status: "modified",
        additions: 0,
        deletions: 0,
        binary: false,
        hunks: [],
      };
      files.push(cur);
      hunk = undefined;
      continue;
    }
    if (!cur) {
      continue;
    }

    if (hunk && (oldLeft > 0 || newLeft > 0)) {
      const c = line[0];
      if (c === "\\") {
        continue; // "\ No newline at end of file"
      }
      hunk.lines.push(line);
      if (c === "+") {
        cur.additions++;
        newLeft--;
      } else if (c === "-") {
        cur.deletions++;
        oldLeft--;
      } else {
        oldLeft--;
        newLeft--;
      }
      continue;
    }

    const h = HUNK_HEADER.exec(line);
    if (h) {
      hunk = {
        oldStart: Number(h[1]),
        oldLines: h[2] === undefined ? 1 : Number(h[2]),
        newStart: Number(h[3]),
        newLines: h[4] === undefined ? 1 : Number(h[4]),
        lines: [],
      };
      oldLeft = hunk.oldLines;
      newLeft = hunk.newLines;
      cur.hunks.push(hunk);
      continue;
    }
    if (hunk) {
      continue; // trailing noise after a hunk
    }

    if (line.startsWith("new file mode")) {
      cur.status = "added";
    } else if (line.startsWith("deleted file mode")) {
      cur.status = "removed";
    } else if (line.startsWith("rename from ")) {
      cur.status = "renamed";
      cur.oldPath = line.slice("rename from ".length);
    } else if (line.startsWith("rename to ")) {
      cur.path = line.slice("rename to ".length);
    } else if (
      line.startsWith("Binary files ") ||
      line.startsWith("GIT binary patch")
    ) {
      cur.binary = true;
    } else if (line.startsWith("+++ b/")) {
      cur.path = line.slice(6);
    } else if (line.startsWith("--- a/") && cur.status === "removed") {
      cur.path = line.slice(6);
    }
  }
  for (const f of files) {
    if (f.status !== "renamed" && f.status !== "removed") {
      delete f.oldPath;
    }
  }
  return files;
}

/** Lines added and removed by a change, without their +/- prefix. */
export function changedLines(file: ChangedFile): {
  added: string[];
  removed: string[];
} {
  const added: string[] = [];
  const removed: string[] = [];
  for (const h of file.hunks) {
    for (const l of h.lines) {
      if (l[0] === "+") {
        added.push(l.slice(1));
      } else if (l[0] === "-") {
        removed.push(l.slice(1));
      }
    }
  }
  return { added, removed };
}

/** Content before the change, when the diff holds all of it (removed files). */
export function contentBefore(file: ChangedFile): string {
  return file.hunks
    .flatMap((h) => h.lines.filter((l) => l[0] !== "+").map((l) => l.slice(1)))
    .join("\n");
}
