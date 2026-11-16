import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { AiRequest, AiUsage, ReviewModel } from "@ripple-review/core/ai";
import { costOf } from "./prices.ts";

/*
 * The AI layer's first provider (D18): Claude through the official SDK, with
 * the answer as structured output (JSON schema). Credentials come from the
 * environment (ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN or an `ant auth login`
 * profile), or as `apiKey` in a browser, where the user's own key goes
 * straight to Anthropic (D22).
 */

export const DEFAULT_MODEL = "claude-opus-5-5";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface AnthropicOptions {
  model?: string;
  /** Thinking depth; set explicitly, the models' defaults differ. */
  effort?: Effort;
  maxTokens?: number;
  /** The user's key, for a browser; without it, credentials come from the environment. */
  apiKey?: string;
  /** For tests; defaults to a client with `apiKey` or the environment's credentials. */
  client?: Anthropic;
  /** Usage of each request (tokens, turns, estimated cost). */
  onUsage?: (usage: AiUsage) => void;
}

export class AiRefusal extends Error {}

/** Model turns per request: reads (core limits them) plus the answer. */
const MAX_TURNS = 8;

export function anthropicModel(options: AnthropicOptions = {}): ReviewModel {
  const model = options.model ?? DEFAULT_MODEL;
  const effort = options.effort ?? "medium";
  let client = options.client;
  return {
    id: `anthropic:${model}:${effort}`,
    async complete(request: AiRequest): Promise<unknown> {
      client ??= options.apiKey
        ? // The key is the user's own and stays in their browser (D22).
          new Anthropic({
            apiKey: options.apiKey,
            dangerouslyAllowBrowser: true,
          })
        : new Anthropic();
      // Fallbacks (opt-in): a request declined by a safety classifier is
      // re-run on Anthropic's recommended fallback model in the same call.
      // Haiku has no server-side fallback.
      const fallbacks = !model.startsWith("claude-haiku");
      const tools = request.tools ?? [];
      const messages: BetaMessageParam[] = [
        { role: "user", content: request.user },
      ];
      const usage = {
        model,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        turns: 0,
        /** A refused request was answered by Anthropic's fallback model. */
        fellBack: false,
      };
      try {
        for (let turn = 1; turn <= MAX_TURNS; turn++) {
          // Streamed: long input and thinking can outlast a plain request's
          // timeout. No prompt caching: models rarely ask for a second turn
          // (2 of 36 runs in the comparison), and a cache write costs 25 %
          // more than plain input.
          const message = await client.beta.messages
            .stream({
              model,
              max_tokens: options.maxTokens ?? 32_000,
              ...(fallbacks
                ? {
                    betas: ["server-side-fallback-2026-07-01"],
                    fallbacks: "default" as const,
                  }
                : {}),
              system: request.system,
              messages,
              ...(tools.length
                ? {
                    tools: tools.map((t) => ({
                      name: t.name,
                      description: t.description,
                      input_schema: {
                        type: "object" as const,
                        ...t.inputSchema,
                      },
                    })),
                  }
                : {}),
              output_config: {
                effort,
                format: { type: "json_schema", schema: request.schema },
              },
            })
            .finalMessage();

          usage.model = message.model;
          usage.turns = turn;
          usage.inputTokens += message.usage.input_tokens;
          usage.outputTokens += message.usage.output_tokens;
          usage.cacheReadTokens += message.usage.cache_read_input_tokens ?? 0;
          usage.cacheWriteTokens +=
            message.usage.cache_creation_input_tokens ?? 0;
          usage.fellBack ||= (message.usage.iterations ?? []).some(
            (i) => i.type === "fallback_message",
          );
          if (message.stop_reason === "refusal") {
            throw new AiRefusal(
              `${model} declined the request${message.stop_details?.explanation ? `: ${message.stop_details.explanation}` : ""}`,
            );
          }
          if (message.stop_reason === "max_tokens") {
            throw new Error(`${model} ran out of output tokens`);
          }
          const calls = message.content.flatMap((b) =>
            b.type === "tool_use" ? [b] : [],
          );
          if (message.stop_reason === "tool_use" && calls.length) {
            messages.push({ role: "assistant", content: message.content });
            messages.push({
              role: "user",
              content: calls.map((c) => {
                const tool = tools.find((t) => t.name === c.name);
                return {
                  type: "tool_result" as const,
                  tool_use_id: c.id,
                  content: tool ? tool.run(c.input) : `Unknown tool ${c.name}.`,
                  ...(tool ? {} : { is_error: true }),
                };
              }),
            });
            continue;
          }
          const text = message.content
            .flatMap((b) => (b.type === "text" ? [b.text] : []))
            .join("");
          return JSON.parse(text);
        }
        throw new Error(`${model} did not answer within ${MAX_TURNS} turns`);
      } finally {
        const { fellBack, ...tokens } = usage;
        options.onUsage?.({
          ...tokens,
          costUsd: costOf(usage.model, usage),
          notes: fellBack ? ["answered by the fallback model"] : [],
        });
      }
    },
  };
}
