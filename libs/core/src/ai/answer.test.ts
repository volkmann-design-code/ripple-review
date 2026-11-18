import { describe, expect, it } from "vitest";
import type { Edge } from "../model.ts";
import { applyAnswer, parseAnswer } from "./answer.ts";
import { edges, groups, item, paths } from "./test-fixtures.ts";

describe("applyAnswer", () => {
  it("names groups, reorders the movable ones and keeps context and generated in place", () => {
    const { groups: out, ignored } = applyAnswer(groups(), edges, {
      order: [3, 1, 2, 4],
      groups: [
        { id: 3, title: "Checkout", purpose: "Adds the checkout." },
        { id: 2, title: "Ignored for mechanical", purpose: "One rename." },
        { id: 0, title: "Docs", purpose: "" },
      ],
      moves: [],
      weakEdges: [],
    });
    expect(out.map((g) => g.title)).toEqual([
      "Context: read first",
      "Checkout",
      "Around `a.ts`",
      "Rename",
      "Standalone changes",
      "Generated",
    ]);
    expect(out[1]?.purpose).toBe("Adds the checkout.");
    expect(out[3]?.purpose).toBe("One rename.");
    expect(ignored).toEqual(["name for group 0"]);
  });

  it("appends groups the order leaves out, in their static order, and ignores unknown ids", () => {
    const { groups: out, ignored } = applyAnswer(groups(), edges, {
      order: [4, 0, 9, 4],
      groups: [],
      moves: [],
      weakEdges: [],
    });
    expect(out.map((g) => g.kind)).toEqual([
      "context",
      "misc",
      "story",
      "mechanical",
      "story",
      "generated",
    ]);
    expect(ignored).toEqual(["group 0 in the order", "group 9 in the order"]);
  });

  it("moves files by the rules, keeps every file once and drops emptied groups", () => {
    const { groups: out, ignored } = applyAnswer(groups(), edges, {
      order: [],
      groups: [],
      moves: [
        { path: "README.md", to: 1, reason: "describes a.ts" },
        { path: "s.ts", to: 3, reason: "part of c" },
        { path: "m1.ts", to: 1, reason: "out of a mechanical group" },
        { path: "a.ts", to: 5, reason: "into generated" },
        { path: "nope.ts", to: 1, reason: "unknown" },
        { path: "b.ts", to: 0, reason: "into context" },
      ],
      weakEdges: [],
    });
    expect(out.map((g) => g.kind)).toEqual([
      "story",
      "mechanical",
      "story",
      "generated",
    ]);
    expect(paths(out).sort()).toEqual(paths(groups()).sort());
    expect(out[0]?.items.map((i) => i.path)).toEqual([
      "README.md",
      "a.ts",
      "b.ts",
    ]);
    expect(out[2]?.items.map((i) => i.path)).toEqual([
      "c.ts",
      "s.ts",
      "c.test.ts",
    ]);
    expect(out[2]?.items[1]?.notes).toEqual(["placed here: part of c"]);
    expect(ignored).toHaveLength(4);
  });

  it("moves a component with its template and styles, never them alone", () => {
    const withComponent = groups();
    withComponent[1]?.items.push(
      item("x.component.ts"),
      item("x.component.html"),
      item("x.component.css"),
    );
    const contains = (to: string): Edge => ({
      from: "x.component.ts",
      to,
      kind: "contains",
      via: [],
    });
    const { groups: out, ignored } = applyAnswer(
      withComponent,
      [...edges, contains("x.component.html"), contains("x.component.css")],
      {
        order: [],
        groups: [],
        moves: [
          { path: "x.component.html", to: 3, reason: "alone" },
          { path: "x.component.ts", to: 3, reason: "with c" },
        ],
        weakEdges: [],
      },
    );
    expect(ignored).toEqual(["move of x.component.html to group 3"]);
    expect(out[1]?.items.map((i) => i.path)).toEqual(["a.ts", "b.ts"]);
    expect(out[3]?.items.map((i) => i.path)).toEqual([
      "c.ts",
      "x.component.ts",
      "x.component.html",
      "x.component.css",
      "c.test.ts",
    ]);
  });

  it("keeps only weak links the analysis found (either direction), and leaves the input untouched", () => {
    const input = groups();
    const { weakEdges } = applyAnswer(input, edges, {
      order: [4],
      groups: [{ id: 1, title: "X", purpose: "Y" }],
      moves: [{ path: "s.ts", to: 1, reason: "r" }],
      weakEdges: [
        { from: "a.ts", to: "b.ts", reason: "comment only" },
        { from: "c.test.ts", to: "c.ts", reason: "reversed" },
        { from: "a.ts", to: "c.ts", reason: "no such edge" },
      ],
    });
    expect(weakEdges).toEqual([
      { from: "a.ts", to: "b.ts", reason: "comment only" },
      { from: "c.ts", to: "c.test.ts", reason: "reversed" },
    ]);
    expect(input).toEqual(groups());
  });
});

describe("parseAnswer", () => {
  it("drops malformed entries instead of failing", () => {
    expect(
      parseAnswer({
        order: [1, "2", 2.5, 3],
        groups: [
          { id: 1, title: " T ", purpose: "P" },
          { title: "no id" },
          null,
        ],
        moves: [
          { path: "a.ts", to: 1 },
          { path: "", to: 2, reason: "" },
        ],
        weakEdges: "nope",
      }),
    ).toEqual({
      order: [1, 3],
      groups: [{ id: 1, title: "T", purpose: "P" }],
      moves: [{ path: "a.ts", to: 1, reason: "" }],
      weakEdges: [],
    });
    expect(parseAnswer("not json")).toEqual({
      order: [],
      groups: [],
      moves: [],
      weakEdges: [],
    });
  });
});
