import { describe, expect, it } from "vitest";
import { costOf } from "./prices.ts";

describe("costOf", () => {
  it("prices input, output, cache reads and writes per million tokens", () => {
    expect(
      costOf("claude-opus-5-5", {
        inputTokens: 1_000_000,
        outputTokens: 100_000,
        cacheReadTokens: 1_000_000,
        cacheWriteTokens: 100_000,
      }),
    ).toBeCloseTo(4 + 2 + 0.2 + 0.5);
    expect(
      costOf("claude-unknown", {
        inputTokens: 1,
        outputTokens: 1,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      }),
    ).toBeUndefined();
  });
});
