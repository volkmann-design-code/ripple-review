/*
 * The AI layer (D2, D18): a model reads the static order and suggests names,
 * a reading order of the groups, files placed where the graph couldn't, and
 * links that are weak. The answer is applied as a validated patch on the
 * static order, so whatever the model says, every changed file is still
 * listed exactly once.
 *
 * Two inputs:
 *   - "full": the order, the links and a trimmed diff of every file in one
 *     prompt;
 *   - "summary": the order, the links and per file the names it changes and
 *     its first changed lines; the model reads the diffs it needs with the
 *     `read_diff` tool, within a budget. Most of a full prompt is diff.
 *
 * Provider-independent: core owns the prompt, the tools, the answer's JSON
 * schema and the validation; a provider (`libs/ai-<provider>`) only runs the
 * conversation.
 *
 *   ai/port.ts       the types a provider implements and returns
 *   ai/prompt.ts     the instructions and the answer's JSON schema
 *   ai/request.ts    the request: full or summary input
 *   ai/excerpts.ts   trimmed diffs and the files that have one
 *   ai/read-diff.ts  the read_diff tool
 *   ai/answer.ts     reading the answer and applying it as a patch
 *   ai/refine.ts     ask and apply; a fake model for tests
 */
export * from "./ai/answer.ts";
export * from "./ai/port.ts";
export { PROMPT_VERSION } from "./ai/prompt.ts";
export * from "./ai/refine.ts";
export * from "./ai/request.ts";
