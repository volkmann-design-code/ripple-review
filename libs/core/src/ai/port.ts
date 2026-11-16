/** The AI layer's port: what core asks of a provider (see ../ai.ts). */

/** A tool the model may call; core runs it, the provider passes it through. */
export interface AiTool {
  name: string;
  description: string;
  /** JSON schema of the tool's input. */
  inputSchema: Record<string, unknown>;
  /** The tool's result as text; never throws (errors are text for the model). */
  run(input: unknown): string;
}

/** What a provider sends to its model. */
export interface AiRequest {
  system: string;
  user: string;
  /** JSON schema the answer must follow (structured output). */
  schema: Record<string, unknown>;
  tools?: AiTool[];
}

/** A model behind some provider. */
export interface ReviewModel {
  /** Provider, model and settings, e.g. "anthropic:claude-opus-5-5:high"; part of the cache key. */
  readonly id: string;
  /**
   * The model's final answer as parsed JSON; core validates it. With tools,
   * the provider runs the conversation until the model answers.
   */
  complete(request: AiRequest): Promise<unknown>;
}

export type AiInput = "full" | "summary";

export interface AiMove {
  path: string;
  /** Index of the target group in the static order. */
  to: number;
  reason: string;
}

export interface AiWeakEdge {
  from: string;
  to: string;
  reason: string;
}

export interface AiAnswer {
  /** Group indices in the suggested reading order (context and generated stay put). */
  order: number[];
  groups: { id: number; title: string; purpose: string }[];
  moves: AiMove[];
  weakEdges: AiWeakEdge[];
}

/** What a call cost, as the provider reports it; for logs and comparisons. */
export interface AiUsage {
  model: string;
  /** Uncached input tokens. */
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** Model calls: 1, plus one per round of tool calls. */
  turns: number;
  /** Estimated price in USD; undefined if the provider doesn't know it. */
  costUsd?: number;
  /** Provider-specific remarks, e.g. that a fallback model answered. */
  notes: string[];
}
