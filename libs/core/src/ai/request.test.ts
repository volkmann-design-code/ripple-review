import { describe, expect, it } from "vitest";
import { buildRequest } from "./request.ts";
import { cs, edges, groups, nodes } from "./test-fixtures.ts";

describe("buildRequest", () => {
  it("full: lists groups with ids, links and the diff, without generated files or repeated mechanical edits", () => {
    const { user, schema, tools } = buildRequest(cs, groups(), edges);
    expect(user).toContain("### Group 1 (story): Around `a.ts`");
    expect(user).toContain("- b.ts ← a.ts (import: x)");
    expect(user).toContain("+in a.ts");
    expect(user).toContain("+in m1.ts");
    expect(user).not.toContain("+in m2.ts");
    expect(user).not.toContain("+in gen.ts");
    expect(user).toContain("## Diff");
    expect(schema.required).toEqual(["order", "groups", "moves", "weakEdges"]);
    expect(tools).toBeUndefined();
  });

  it("summary: names the diff touches and first changed lines instead of the diff, and a read_diff tool", () => {
    const { user, tools } = buildRequest(cs, groups(), edges, {
      input: "summary",
      nodes,
    });
    expect(user).not.toContain("## Diff");
    expect(user).toContain(
      "- a.ts · source · modified · +1 −0\n  touches: in\n  +in a.ts",
    );
    expect(user).not.toContain("untouched");
    expect(user).not.toContain("+in gen.ts");
    expect(tools?.map((t) => t.name)).toEqual(["read_diff"]);
  });
});

describe("read_diff", () => {
  const tool = () => {
    const r = buildRequest(cs, groups(), edges, { input: "summary" });
    return { run: r.tools![0]!.run, reads: r.reads };
  };

  it("returns the diff of known files and refuses generated and repeated mechanical ones", () => {
    const { run, reads } = tool();
    const out = run({ paths: ["a.ts", "gen.ts", "m2.ts", "nope.ts"] });
    expect(out).toContain("### a.ts\n```diff\n@@ -1,0 +1,1 @@\n+in a.ts\n```");
    expect(out.match(/not available/g)).toHaveLength(3);
    expect(reads).toEqual(["a.ts"]);
  });

  it("stops after three calls and tolerates bad input", () => {
    const { run } = tool();
    expect(run("nonsense")).toBe("No paths given.");
    run({ paths: ["a.ts"] });
    run({ paths: ["b.ts"] });
    expect(run({ paths: ["c.ts"] })).toContain("budget is used up");
  });
});
