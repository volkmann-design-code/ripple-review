import { describe, expect, it } from "vitest";
import { findMechanical } from "./mechanical.ts";
import type { ChangedFile, FileNode } from "./model.ts";

function node(
  path: string,
  removed: string[],
  added: string[],
  status: ChangedFile["status"] = "modified",
): FileNode {
  const lines = [...removed.map((l) => `-${l}`), ...added.map((l) => `+${l}`)];
  return {
    role: "source",
    file: {
      path,
      status,
      additions: added.length,
      deletions: removed.length,
      binary: false,
      hunks: [
        {
          oldStart: 1,
          oldLines: removed.length,
          newStart: 1,
          newLines: added.length,
          lines,
        },
      ],
    },
  };
}

const moveImport = (path: string, from: string, to: string) =>
  node(
    path,
    [`import { WithSession } from "${from}";`],
    [`import { WithSession } from "${to}";`],
  );

describe("findMechanical", () => {
  it("groups the same small edit across files, whatever the string literals", () => {
    const groups = findMechanical([
      moveImport("apps/a.ts", "./session", "@x/auth/session"),
      moveImport("apps/b/b.ts", "../session", "@x/auth/session"),
      moveImport("libs/c.ts", "../../apps/session", "@x/auth/session"),
      node("libs/other.ts", ["const a = 1;"], ["const a = 2;"]),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.files).toEqual(["apps/a.ts", "apps/b/b.ts", "libs/c.ts"]);
    expect(groups[0]!.lines).toEqual([
      '-import { WithSession } from "./session";',
      '+import { WithSession } from "@x/auth/session";',
    ]);
  });

  it("ignores whitespace differences", () => {
    const groups = findMechanical([
      node("a.ts", [], ["  foo(bar,  baz);"]),
      node("b.ts", [], ["foo(bar, baz);"]),
      node("c.ts", [], ["\tfoo(bar, baz);  "]),
    ]);
    expect(groups.map((g) => g.files)).toEqual([["a.ts", "b.ts", "c.ts"]]);
  });

  it("keeps literals that aren't paths, so JSON keys don't all match", () => {
    const groups = findMechanical([
      node("a/package.json", [], ['"scripts": {', '"test": "vitest"']),
      node("b/package.json", [], ['"scripts": {', '"test": "vitest"']),
      node("c/package.json", [], ['"scripts": {', '"test": "vitest"']),
      node("biome.json", [], ['"linter": {', '"rules": {', '"style": {']),
    ]);
    expect(groups.map((g) => g.files)).toEqual([
      ["a/package.json", "b/package.json", "c/package.json"],
    ]);
  });

  it("needs at least three files", () => {
    expect(
      findMechanical([
        moveImport("a.ts", "./s", "./t"),
        moveImport("b.ts", "./s", "./t"),
      ]),
    ).toEqual([]);
  });

  it("leaves out large, added and removed files", () => {
    const big = node(
      "big.ts",
      ['import { WithSession } from "./s";'],
      ['import { WithSession } from "./t";', ...Array(12).fill("x();")],
    );
    const added = moveImport("added.ts", "./s", "./t");
    added.file.status = "added";
    const groups = findMechanical([
      big,
      added,
      moveImport("a.ts", "./s", "./t"),
      moveImport("b.ts", "./s", "./t"),
      moveImport("c.ts", "./s", "./t"),
    ]);
    expect(groups.map((g) => g.files)).toEqual([["a.ts", "b.ts", "c.ts"]]);
  });

  it("leaves out files whose edit is mostly something else", () => {
    const mixed = node(
      "mixed.ts",
      ['import { WithSession } from "./s";'],
      ["const one = 1;", "const two = 2;", "const three = 3;"],
    );
    const groups = findMechanical([
      mixed,
      moveImport("a.ts", "./s", "./t"),
      moveImport("b.ts", "./s", "./t"),
      moveImport("c.ts", "./s", "./t"),
    ]);
    expect(groups.map((g) => g.files)).toEqual([["a.ts", "b.ts", "c.ts"]]);
  });

  it("does not count trivial lines as shared", () => {
    expect(
      findMechanical([
        node("a.ts", [], ["}", ");"]),
        node("b.ts", [], ["}", ");"]),
        node("c.ts", [], ["}", ");"]),
      ]),
    ).toEqual([]);
  });

  it("groups inline values replaced by a shared constant of the same value", () => {
    const imp = 'import { DAY_MS } from "@app/date-utils";';
    const groups = findMechanical([
      node(
        "a.ts",
        ["const from = ts - 24 * 3_600_000;"],
        [imp, "const from = ts - DAY_MS;"],
      ),
      node(
        "b.ts",
        ["export const REFUND = 14 * 24 * 3_600_000;"],
        [imp, "export const REFUND = 14 * DAY_MS;"],
      ),
      node("c.ts", ["const DAY_MS = 24 * 60 * 60 * 1000;"], [imp]),
      node(
        "d.ts",
        ["  return d + n * 86_400_000;", "x(3 * 86_400_000);"],
        [imp, "  return d + n * DAY_MS;", "x(3 * DAY_MS);"],
      ),
      node(
        "e.ts",
        ["const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days"],
        [imp, "const MAX_AGE_MS = 30 * DAY_MS;"],
      ),
      node(
        "f.ts",
        [
          "const WINDOW_MS = 24 * 60 * 60 * 1000;",
          "const HOUR_MS = 60 * 60 * 1000;",
        ],
        [
          'import { DAY_MS, HOUR_MS } from "@app/date-utils";',
          "const WINDOW_MS = DAY_MS;",
        ],
      ),
    ]);
    expect(groups).toEqual([
      {
        lines: ["DAY_MS for the same value", `+${imp}`],
        files: ["a.ts", "b.ts", "c.ts", "d.ts", "e.ts", "f.ts"],
      },
    ]);
  });

  it("does not take a different value for the same edit", () => {
    const imp = 'import { DAY_MS } from "@app/date-utils";';
    const groups = findMechanical([
      node("a.ts", ["const DAY_MS = 86_400_000;"], [imp]),
      node("b.ts", ["wait(2 * 3_600_000);"], [imp, "wait(2 * DAY_MS);"]),
      node("c.ts", ["wait(3_600_000);"], [imp, "wait(DAY_MS);"]),
    ]);
    expect(groups.flatMap((g) => g.lines)).not.toContain(
      "DAY_MS for the same value",
    );
  });

  it("groups string literals replaced by a shared constant", () => {
    const def = 'export const API_BASE = "https://x.de";';
    const groups = findMechanical([
      node("api.ts", [], [def]),
      node(
        "a.ts",
        ['fetch("https://x.de/users");'],
        // biome-ignore lint/suspicious/noTemplateCurlyInString: a template literal inside a diff line
        ["fetch(`${API_BASE}/users`);"],
      ),
      node(
        "b.ts",
        ['fetch("https://x.de/orders");'],
        ['fetch(API_BASE + "/orders");'],
      ),
      node("c.ts", ['const U = "https://x.de";'], ["const U = API_BASE;"]),
    ]);
    expect(groups).toEqual([
      {
        lines: ["API_BASE for the same value"],
        files: ["a.ts", "b.ts", "c.ts"],
      },
    ]);
  });

  it("does not take a different path for the same value", () => {
    const groups = findMechanical([
      node("a.ts", ['const A = "/a";'], ['const A = "/b";']),
      node("b.ts", ['const B = "/a";'], ['const B = "/b";']),
      node("c.ts", ['const C = "/a";'], ['const C = "/b";']),
    ]);
    expect(groups.flatMap((g) => g.lines)).not.toContainEqual(
      expect.stringContaining("for the same value"),
    );
  });

  it("reads identical new files as one edit", () => {
    const cfg = [
      'import { createVitestConfig } from "../../vitest.shared.ts";',
      "export default createVitestConfig();",
    ];
    const groups = findMechanical([
      node("libs/a/vitest.config.ts", [], cfg, "added"),
      node("libs/b/vitest.config.ts", [], cfg, "added"),
      node("apps/c/vitest.config.ts", [], cfg, "added"),
      node("libs/d/other.ts", [], ["export const x = 1;"], "added"),
    ]);
    expect(groups).toEqual([
      {
        lines: [cfg[0]],
        files: [
          "apps/c/vitest.config.ts",
          "libs/a/vitest.config.ts",
          "libs/b/vitest.config.ts",
        ],
        newFiles: true,
      },
    ]);
  });
});
