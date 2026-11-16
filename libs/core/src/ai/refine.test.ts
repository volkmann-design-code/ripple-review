import { describe, expect, it } from "vitest";
import { fakeModel, refine } from "./refine.ts";
import { cs, edges, groups } from "./test-fixtures.ts";

describe("refine", () => {
  it("sends the request to the model and applies its answer", async () => {
    const model = fakeModel({
      order: [4, 1, 2, 3],
      groups: [{ id: 4, title: "Helper", purpose: "A helper." }],
      moves: [],
      weakEdges: [],
    });
    const { groups: out } = await refine(model, cs, groups(), edges);
    expect(model.requests).toHaveLength(1);
    expect(out.map((g) => g.title)[1]).toBe("Helper");
  });

  it("reports the files the model read", async () => {
    const model = fakeModel({ order: [] }, "fake", [
      { name: "read_diff", input: { paths: ["c.ts", "s.ts"] } },
    ]);
    const { reads } = await refine(model, cs, groups(), edges, {
      input: "summary",
    });
    expect(reads).toEqual(["c.ts", "s.ts"]);
    expect(model.toolResults[0]).toContain("+in s.ts");
  });
});
