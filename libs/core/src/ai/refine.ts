import type { ChangeSet, Edge, ReviewGroup } from "../model.ts";
import { type AiResult, applyAnswer, parseAnswer } from "./answer.ts";
import type { AiRequest, ReviewModel } from "./port.ts";
import { type BuildOptions, buildRequest } from "./request.ts";

/** Asks the model about the static order and applies its answer. */
export async function refine(
  model: ReviewModel,
  cs: ChangeSet,
  groups: ReviewGroup[],
  edges: Edge[],
  options: BuildOptions = {},
): Promise<AiResult> {
  const { reads, ...request } = buildRequest(cs, groups, edges, options);
  const raw = await model.complete(request);
  return { ...applyAnswer(groups, edges, parseAnswer(raw)), reads };
}

/**
 * A model that returns a fixed answer, for tests; with `toolCalls`, it first
 * calls the request's tools and keeps their results.
 */
export function fakeModel(
  answer: unknown,
  id = "fake",
  toolCalls: { name: string; input: unknown }[] = [],
): ReviewModel & { requests: AiRequest[]; toolResults: string[] } {
  const requests: AiRequest[] = [];
  const toolResults: string[] = [];
  return {
    id,
    requests,
    toolResults,
    complete(request) {
      requests.push(request);
      for (const c of toolCalls) {
        const tool = request.tools?.find((t) => t.name === c.name);
        toolResults.push(tool ? tool.run(c.input) : `unknown tool ${c.name}`);
      }
      return Promise.resolve(answer);
    },
  };
}
