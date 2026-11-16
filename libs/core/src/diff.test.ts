import { describe, expect, it } from "vitest";
import { changedLines, contentBefore, parseUnifiedDiff } from "./diff.ts";

const diff = (...lines: string[]) => `${lines.join("\n")}\n`;

describe("parseUnifiedDiff", () => {
  it("parses a modified file with counts and hunks", () => {
    const [f, ...rest] = parseUnifiedDiff(
      diff(
        "diff --git a/src/a.ts b/src/a.ts",
        "index 1111111..2222222 100644",
        "--- a/src/a.ts",
        "+++ b/src/a.ts",
        "@@ -1,3 +1,3 @@",
        " keep",
        "-old",
        "+new",
        " keep",
        "@@ -10 +10,2 @@ function x() {",
        " ten",
        "+eleven",
      ),
    );
    expect(rest).toEqual([]);
    expect(f).toMatchObject({
      path: "src/a.ts",
      status: "modified",
      additions: 2,
      deletions: 1,
      binary: false,
    });
    expect(f!.oldPath).toBeUndefined();
    expect(
      f!.hunks.map((h) => [h.oldStart, h.oldLines, h.newStart, h.newLines]),
    ).toEqual([
      [1, 3, 1, 3],
      [10, 1, 10, 2],
    ]);
    expect(f!.hunks[1]!.lines).toEqual([" ten", "+eleven"]);
  });

  it("parses added and removed files", () => {
    const files = parseUnifiedDiff(
      diff(
        "diff --git a/new.sql b/new.sql",
        "new file mode 100644",
        "index 0000000..1111111",
        "--- /dev/null",
        "+++ b/new.sql",
        "@@ -0,0 +1,2 @@",
        "+create table t ();",
        "+select 1;",
        "diff --git a/gone.ts b/gone.ts",
        "deleted file mode 100644",
        "index 1111111..0000000",
        "--- a/gone.ts",
        "+++ /dev/null",
        "@@ -1,2 +0,0 @@",
        "-export const a = 1;",
        "-export const b = 2;",
      ),
    );
    expect(
      files.map((f) => [f.path, f.status, f.additions, f.deletions]),
    ).toEqual([
      ["new.sql", "added", 2, 0],
      ["gone.ts", "removed", 0, 2],
    ]);
    expect(files[0]!.oldPath).toBeUndefined();
    expect(contentBefore(files[1]!)).toBe(
      "export const a = 1;\nexport const b = 2;",
    );
  });

  it("parses renames, with and without content changes", () => {
    const files = parseUnifiedDiff(
      diff(
        "diff --git a/old/name.ts b/new/name.ts",
        "similarity index 100%",
        "rename from old/name.ts",
        "rename to new/name.ts",
        "diff --git a/x.ts b/y.ts",
        "similarity index 90%",
        "rename from x.ts",
        "rename to y.ts",
        "index 1111111..2222222 100644",
        "--- a/x.ts",
        "+++ b/y.ts",
        "@@ -1 +1 @@",
        "-a",
        "+b",
      ),
    );
    expect(
      files.map((f) => [f.oldPath, f.path, f.status, f.hunks.length]),
    ).toEqual([
      ["old/name.ts", "new/name.ts", "renamed", 0],
      ["x.ts", "y.ts", "renamed", 1],
    ]);
  });

  it("treats `--- ` and `+++ ` inside a hunk as content", () => {
    const [f, g] = parseUnifiedDiff(
      diff(
        "diff --git a/m.sql b/m.sql",
        "--- a/m.sql",
        "+++ b/m.sql",
        "@@ -1,2 +1,2 @@",
        "--- a/comment",
        "+++ b/comment",
        " select 1;",
        "diff --git a/n.sql b/n.sql",
        "--- a/n.sql",
        "+++ b/n.sql",
        "@@ -1 +1 @@",
        "-x",
        "+y",
      ),
    );
    expect(f!.path).toBe("m.sql");
    expect(changedLines(f!)).toEqual({
      removed: ["-- a/comment"],
      added: ["++ b/comment"],
    });
    expect(g!.path).toBe("n.sql");
  });

  it("skips no-newline markers without counting them", () => {
    const [f] = parseUnifiedDiff(
      diff(
        "diff --git a/a.txt b/a.txt",
        "--- a/a.txt",
        "+++ b/a.txt",
        "@@ -1 +1 @@",
        "-old",
        "\\ No newline at end of file",
        "+new",
        "\\ No newline at end of file",
      ),
    );
    expect(f!.hunks[0]!.lines).toEqual(["-old", "+new"]);
    expect([f!.additions, f!.deletions]).toEqual([1, 1]);
  });

  it("counts a context line stripped to empty", () => {
    const [f] = parseUnifiedDiff(
      diff(
        "diff --git a/a.md b/a.md",
        "--- a/a.md",
        "+++ b/a.md",
        "@@ -1,3 +1,3 @@",
        "",
        "-a",
        "+b",
        "",
      ),
    );
    expect(f!.hunks[0]!.lines).toEqual(["", "-a", "+b", ""]);
  });

  it("marks binary files", () => {
    const [f] = parseUnifiedDiff(
      diff(
        "diff --git a/logo.png b/logo.png",
        "new file mode 100644",
        "index 0000000..1111111",
        "Binary files /dev/null and b/logo.png differ",
      ),
    );
    expect(f).toMatchObject({
      path: "logo.png",
      status: "added",
      binary: true,
    });
  });

  it("returns nothing for an empty diff", () => {
    expect(parseUnifiedDiff("")).toEqual([]);
  });
});
