import { describe, expect, it } from "vitest";
import type { Analysis } from "./graph.ts";
import type { Edge, EdgeKind, FileNode, Role } from "./model.ts";
import { orderWithParts, planReview } from "./order.ts";

function analysis(
  files: [string, Role][],
  edges: [string, string, EdgeKind][],
): Analysis {
  const nodes = new Map<string, FileNode>(
    files.map(([path, role]) => [
      path,
      {
        file: {
          path,
          status: "modified",
          additions: 1,
          deletions: 0,
          binary: false,
          hunks: [],
        },
        role,
      },
    ]),
  );
  return {
    nodes,
    edges: edges.map(([from, to, kind]): Edge => ({ from, to, kind, via: [] })),
  };
}

const stories = (a: Analysis) =>
  planReview(a)
    .groups.filter((g) => g.kind === "story")
    .map((g) => g.items.map((i) => i.path).sort());

describe("planReview", () => {
  it("keeps two stories apart that both use a type everyone imports", () => {
    // model is imported and named by all six files; each story's files use
    // each other. Undamped, b's ties to model outweigh its own and it merges.
    const a = ["a1", "a2", "a3"];
    const b = ["b1", "b2", "b3"];
    const chain = (xs: string[]) =>
      xs
        .slice(1)
        .map((x, i): [string, string, EdgeKind] => [xs[i]!, x, "import"]);
    const result = stories(
      analysis(
        [
          ["model", "source"],
          ...[...a, ...b].map((f): [string, Role] => [f, "source"]),
        ],
        [
          ...[...a, ...b].flatMap((f): [string, string, EdgeKind][] => [
            ["model", f, "import"],
            ["model", f, "name"],
          ]),
          ...chain(a),
          ...chain(b),
        ],
      ),
    );
    expect(result).toHaveLength(2);
    expect(result.find((s) => s.includes("a1"))).not.toContain("b1");
    expect(result.find((s) => s.includes("b1"))).not.toContain("a1");
  });

  it("keeps a migration with all the functions it includes, linked or not", () => {
    const fns = ["f1", "f2", "f3", "f4", "f5", "pair1", "pair2"];
    const result = stories(
      analysis(
        [
          ["migration", "schema"],
          ...fns.map((f): [string, Role] => [f, "schema"]),
        ],
        [
          ...fns.map((f): [string, string, EdgeKind] => [
            "migration",
            f,
            "contains",
          ]),
          ["pair1", "pair2", "name"],
          ["pair2", "pair1", "name"],
        ],
      ),
    );
    expect(result).toEqual([["migration", ...fns].sort()]);
  });
});

describe("orderWithParts", () => {
  const edge = (from: string, to: string, kind: EdgeKind): Edge => ({
    from,
    to,
    kind,
    via: [],
  });
  const byPath = (a: string, b: string) => a.localeCompare(b);

  it("reads a component's template and styles right after it", () => {
    // detail.html binds the tracking component: tracking first, whole.
    // Sorted by path alone, detail.ts would come between tracking.ts and its
    // template.
    const ts = "detail/tracking/tracking.component.ts";
    const html = "detail/tracking/tracking.component.html";
    const css = "detail/tracking/tracking.component.css";
    const files = [
      "detail/detail.component.html",
      "detail/detail.component.ts",
      "detail/tracking.query.ts",
      css,
      html,
      ts,
    ];
    const edges = [
      edge(
        "detail/detail.component.ts",
        "detail/detail.component.html",
        "contains",
      ),
      edge(ts, html, "contains"),
      edge(ts, css, "contains"),
      edge(ts, "detail/detail.component.html", "framework"),
      edge("detail/tracking.query.ts", ts, "import"),
      edge("detail/tracking.query.ts", "detail/detail.component.ts", "import"),
    ];
    expect(orderWithParts(files, edges, byPath)).toEqual([
      "detail/tracking.query.ts",
      ts,
      html,
      css,
      "detail/detail.component.ts",
      "detail/detail.component.html",
    ]);
  });

  it("places every file once when hosts contain each other", () => {
    const edges = [
      edge("a", "b", "contains"),
      edge("b", "a", "contains"),
      edge("a", "c", "contains"),
    ];
    expect(orderWithParts(["a", "b", "c"], edges, byPath).sort()).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("leaves a part of several hosts after all of them", () => {
    const edges = [
      edge("a.php", "header.php", "contains"),
      edge("b.php", "header.php", "contains"),
      edge("a.php", "a-only.php", "contains"),
    ];
    expect(
      orderWithParts(
        ["a.php", "a-only.php", "b.php", "header.php"],
        edges,
        byPath,
      ),
    ).toEqual(["a.php", "a-only.php", "b.php", "header.php"]);
  });
});
