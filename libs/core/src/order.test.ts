import { describe, expect, it } from "vitest";
import type { Analysis } from "./graph.ts";
import type { Edge, EdgeKind, FileNode, Role } from "./model.ts";
import { planReview } from "./order.ts";

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
