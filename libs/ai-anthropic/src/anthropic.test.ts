import type Anthropic from "@anthropic-ai/sdk";
import type { AiUsage } from "@ripple-review/core/ai";
import { describe, expect, it } from "vitest";
import { AiRefusal, anthropicModel } from "./anthropic.ts";

/** A client whose stream returns the given messages in turn and records the params. */
function stubClient(...replies: Record<string, unknown>[]) {
  const params: Record<string, unknown>[] = [];
  const client = {
    beta: {
      messages: {
        stream(p: Record<string, unknown>) {
          // A copy: the provider keeps appending to its messages array.
          params.push(structuredClone(p));
          const reply = replies[Math.min(params.length, replies.length) - 1];
          return { finalMessage: () => Promise.resolve(reply) };
        },
      },
    },
  } as unknown as Anthropic;
  return { client, params };
}

const message = (over: Record<string, unknown> = {}) => ({
  model: "claude-opus-5-5",
  stop_reason: "end_turn",
  content: [
    { type: "thinking", thinking: "" },
    { type: "text", text: '{"order":[1]}' },
  ],
  usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0 },
  ...over,
});

const request = { system: "s", user: "u", schema: { type: "object" } };

describe("anthropicModel", () => {
  it("asks for structured output with an explicit effort and returns the parsed answer", async () => {
    const { client, params } = stubClient(message());
    const usage: AiUsage[] = [];
    const model = anthropicModel({ client, onUsage: (u) => usage.push(u) });
    expect(model.id).toBe("anthropic:claude-opus-5-5:medium");
    expect(await model.complete(request)).toEqual({ order: [1] });
    expect(params[0]).toMatchObject({
      model: "claude-opus-5-5",
      system: "s",
      fallbacks: "default",
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: { type: "object" } },
      },
    });
    expect(usage).toEqual([
      {
        model: "claude-opus-5-5",
        inputTokens: 10,
        outputTokens: 5,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        turns: 1,
        costUsd: (10 * 4 + 5 * 20) / 1e6,
        notes: [],
      },
    ]);
  });

  it("raises on a refusal and on a cut-off answer", async () => {
    await expect(
      anthropicModel({
        client: stubClient(message({ stop_reason: "refusal", content: [] }))
          .client,
      }).complete(request),
    ).rejects.toBeInstanceOf(AiRefusal);
    await expect(
      anthropicModel({
        client: stubClient(message({ stop_reason: "max_tokens" })).client,
      }).complete(request),
    ).rejects.toThrow("ran out of output tokens");
  });
});

describe("fallbacks", () => {
  it("are left out for Haiku, which has none", async () => {
    const { client, params } = stubClient(message());
    await anthropicModel({ client, model: "claude-haiku-5-5" }).complete(
      request,
    );
    expect(params[0]).not.toHaveProperty("fallbacks");
    expect(params[0]).not.toHaveProperty("betas");
  });
});

describe("tools", () => {
  it("runs the tools the model calls and sends the results back until it answers", async () => {
    const toolTurn = message({
      stop_reason: "tool_use",
      content: [
        {
          type: "tool_use",
          id: "t1",
          name: "read_diff",
          input: { paths: ["a.ts"] },
        },
        { type: "tool_use", id: "t2", name: "nope", input: {} },
      ],
      usage: {
        input_tokens: 100,
        output_tokens: 20,
        cache_creation_input_tokens: 90,
      },
    });
    const { client, params } = stubClient(toolTurn, message());
    const usage: AiUsage[] = [];
    const seen: unknown[] = [];
    const answer = await anthropicModel({
      client,
      onUsage: (u) => usage.push(u),
    }).complete({
      ...request,
      tools: [
        {
          name: "read_diff",
          description: "d",
          inputSchema: { properties: {} },
          run: (input) => {
            seen.push(input);
            return "diff of a.ts";
          },
        },
      ],
    });
    expect(answer).toEqual({ order: [1] });
    expect(seen).toEqual([{ paths: ["a.ts"] }]);
    expect(params).toHaveLength(2);
    expect(params[0]).toMatchObject({
      tools: [{ name: "read_diff", input_schema: { type: "object" } }],
    });
    expect(params[1]?.messages).toEqual([
      { role: "user", content: "u" },
      { role: "assistant", content: toolTurn.content },
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "t1", content: "diff of a.ts" },
          {
            type: "tool_result",
            tool_use_id: "t2",
            content: "Unknown tool nope.",
            is_error: true,
          },
        ],
      },
    ]);
    expect(usage[0]).toMatchObject({
      inputTokens: 110,
      outputTokens: 25,
      cacheWriteTokens: 90,
      turns: 2,
    });
  });

  it("gives up after too many turns", async () => {
    const loop = message({
      stop_reason: "tool_use",
      content: [{ type: "tool_use", id: "t", name: "x", input: {} }],
    });
    await expect(
      anthropicModel({ client: stubClient(loop).client }).complete(request),
    ).rejects.toThrow("did not answer within 8 turns");
  });
});
