import { fakeModel } from "@ripple-review/core/ai";
import { describe, expect, it } from "vitest";
import { cached, modelFor } from "./ai.ts";
import { MemoryStore } from "./store.ts";

const request = { system: "s", user: "u", schema: {} };

describe("cached", () => {
  it("asks the model once per request and model", async () => {
    const store = new MemoryStore();
    const hits: string[] = [];
    const model = fakeModel({ order: [1] });
    const c = cached(model, store, (key) => hits.push(key));
    expect(await c.complete(request)).toEqual({ order: [1] });
    expect(await c.complete(request)).toEqual({ order: [1] });
    expect(model.requests).toHaveLength(1);
    await c.complete({ ...request, user: "other" });
    await cached(fakeModel({}, "other-model"), store).complete(request);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(model.requests).toHaveLength(2);
  });
});

describe("modelFor", () => {
  it("defaults to Claude and checks provider and effort", () => {
    expect(modelFor(undefined, undefined).id).toBe(
      "anthropic:claude-opus-5-5:medium",
    );
    expect(modelFor("anthropic:claude-fable-5-2", "medium").id).toBe(
      "anthropic:claude-fable-5-2:medium",
    );
    expect(() => modelFor("openai:x", undefined)).toThrow(
      "unknown AI provider",
    );
    expect(() => modelFor(undefined, "huge")).toThrow("--ai-effort");
  });
});
