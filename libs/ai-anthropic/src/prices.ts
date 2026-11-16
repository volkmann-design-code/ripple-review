/** Claude prices in USD per million tokens, for the models compared in phase 04. */
const PRICES: Record<
  string,
  { input: number; output: number; cacheRead: number }
> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-fable-5-2": { input: 8, output: 40, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1 },
  // Up to 100k tokens of prompt; 0.50 / 2.50 above.
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.1 },
};

export interface Tokens {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

/** Estimated cost of a call in USD; undefined for a model without a price here. */
export function costOf(model: string, t: Tokens): number | undefined {
  const p = PRICES[model];
  return p
    ? (t.inputTokens * p.input +
        t.outputTokens * p.output +
        t.cacheReadTokens * p.cacheRead +
        // 5-minute cache writes cost 1.25 times the input price.
        t.cacheWriteTokens * p.input * 1.25) /
        1e6
    : undefined;
}
