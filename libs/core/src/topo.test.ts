import { describe, expect, it } from "vitest";
import { topoOrder } from "./topo.ts";

const alpha = (a: string, b: string) => a.localeCompare(b);
const reverse = (a: string, b: string) => b.localeCompare(a);
const e = (from: string, to: string) => ({ from, to });

describe("topoOrder", () => {
  it("follows edges over the comparator", () => {
    expect(
      topoOrder(["c", "b", "a"], [e("c", "b"), e("b", "a")], alpha),
    ).toEqual(["c", "b", "a"]);
  });

  it("breaks ties with the comparator", () => {
    expect(topoOrder(["b", "c", "a"], [], alpha)).toEqual(["a", "b", "c"]);
    expect(topoOrder(["b", "c", "a"], [], reverse)).toEqual(["c", "b", "a"]);
  });

  it("picks the smallest ready node, including newly ready ones", () => {
    // a unlocks z, which must still wait for x and y.
    expect(topoOrder(["x", "y", "z", "a"], [e("a", "z")], alpha)).toEqual([
      "a",
      "x",
      "y",
      "z",
    ]);
    // a unlocks b, which goes before y.
    expect(topoOrder(["y", "b", "a"], [e("a", "b")], alpha)).toEqual([
      "a",
      "b",
      "y",
    ]);
  });

  it("keeps a cycle together, its members sorted, placed by its smallest member", () => {
    const order = topoOrder(
      ["a", "b", "c", "d"],
      [e("b", "a"), e("a", "b"), e("d", "a"), e("b", "c")],
      alpha,
    );
    expect(order).toEqual(["d", "a", "b", "c"]);
  });

  it("orders cycles among themselves", () => {
    const order = topoOrder(
      ["p", "q", "a", "b"],
      [e("p", "q"), e("q", "p"), e("a", "b"), e("b", "a"), e("q", "a")],
      alpha,
    );
    expect(order).toEqual(["p", "q", "a", "b"]);
  });

  it("ignores self loops and edges to unknown ids", () => {
    expect(
      topoOrder(["a", "b"], [e("a", "a"), e("x", "a"), e("b", "y")], alpha),
    ).toEqual(["a", "b"]);
  });

  it("returns every id exactly once", () => {
    const ids = Array.from({ length: 50 }, (_, i) => `n${i}`);
    const edges = ids.flatMap((id, i) => [
      e(id, ids[(i * 7 + 3) % 50]!),
      e(id, ids[(i * 13 + 1) % 50]!),
    ]);
    const order = topoOrder(ids, edges, alpha);
    expect(order).toHaveLength(50);
    expect(new Set(order).size).toBe(50);
  });
});
