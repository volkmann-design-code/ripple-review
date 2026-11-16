import { describe, expect, it } from "vitest";
import { louvain, type WeightedEdge } from "./community.ts";

const w = (a: string, b: string, weight = 1): WeightedEdge => ({
  a,
  b,
  w: weight,
});

/** The partition as sorted groups, independent of community numbering. */
function groups(m: Map<string, number>): string[][] {
  const by = new Map<number, string[]>();
  for (const [n, c] of m) {
    by.set(c, [...(by.get(c) ?? []), n]);
  }
  return [...by.values()]
    .map((g) => g.sort())
    .sort((a, b) => a[0]!.localeCompare(b[0]!));
}

const twoTriangles = [
  w("a", "b"),
  w("b", "c"),
  w("c", "a"),
  w("x", "y"),
  w("y", "z"),
  w("z", "x"),
  w("c", "x", 0.25),
];

describe("louvain", () => {
  it("splits two dense clusters joined by a weak edge", () => {
    const m = louvain(["a", "b", "c", "x", "y", "z"], twoTriangles);
    expect(groups(m)).toEqual([
      ["a", "b", "c"],
      ["x", "y", "z"],
    ]);
  });

  it("is deterministic", () => {
    const nodes = Array.from({ length: 40 }, (_, i) => `n${i}`);
    const edges = nodes.flatMap((n, i) => [
      w(n, nodes[(i + 1) % 40]!, 1 + (i % 3)),
      w(n, nodes[(i * 7) % 40]!, 0.5),
    ]);
    const first = louvain(nodes, edges);
    for (let i = 0; i < 5; i++) {
      expect(louvain(nodes, edges)).toEqual(first);
    }
  });

  it("finds the same partition whatever the node order", () => {
    const nodes = ["a", "b", "c", "x", "y", "z"];
    expect(groups(louvain([...nodes].reverse(), twoTriangles))).toEqual(
      groups(louvain(nodes, twoTriangles)),
    );
  });

  it("leaves unconnected nodes alone", () => {
    const m = louvain(["a", "b", "c"], [w("a", "b")]);
    expect(groups(m)).toEqual([["a", "b"], ["c"]]);
    expect(groups(louvain(["a", "b"], []))).toEqual([["a"], ["b"]]);
  });

  it("ignores self loops and unknown nodes", () => {
    const m = louvain(["a", "b"], [w("a", "a", 5), w("a", "q"), w("a", "b")]);
    expect(groups(m)).toEqual([["a", "b"]]);
  });

  it("assigns every node", () => {
    expect([...louvain(["a", "b", "c"], twoTriangles).keys()].sort()).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});
