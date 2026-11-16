import {
  anthropicModel,
  DEFAULT_MODEL,
  type Effort,
} from "@ripple-review/ai-anthropic";
import {
  type AiInput,
  type AiRequest,
  type AiUsage,
  PROMPT_VERSION,
  type ReviewModel,
} from "@ripple-review/core/ai";
import { type Store, sha256 } from "./store.ts";

const EFFORTS: Effort[] = ["low", "medium", "high", "xhigh", "max"];

/**
 * The model for `--ai-model` / `--ai-effort`. Anthropic is the only provider
 * so far (D18); a `provider:` prefix is accepted for when there are more.
 */
export function modelFor(
  spec: string | undefined,
  effort: string | undefined,
  onUsage?: (u: AiUsage) => void,
  /** The user's key (the web app); without it, the environment's credentials. */
  apiKey?: string,
): ReviewModel {
  const [provider, name] = spec?.includes(":")
    ? spec.split(":", 2)
    : ["anthropic", spec];
  if (provider !== "anthropic") {
    throw new Error(`unknown AI provider "${provider}" (known: anthropic)`);
  }
  if (effort !== undefined && !EFFORTS.includes(effort as Effort)) {
    throw new Error(`--ai-effort must be one of ${EFFORTS.join(", ")}`);
  }
  return anthropicModel({
    model: name || DEFAULT_MODEL,
    effort: effort as Effort | undefined,
    onUsage,
    ...(apiKey ? { apiKey } : {}),
  });
}

/** `--ai-input`: the whole trimmed diff, or a summary the model reads into. */
export function aiInput(v: string | undefined): AiInput {
  if (v === undefined || v === "full" || v === "summary") {
    return v ?? "summary";
  }
  throw new Error("--ai-input must be full or summary");
}

/**
 * Answers cached by model, prompt version and request (which holds the
 * static order and the diff): the same change asks the model once.
 */
export function cached(
  model: ReviewModel,
  store: Store,
  onHit?: (key: string) => void,
): ReviewModel {
  return {
    id: model.id,
    async complete(request: AiRequest) {
      const key = await sha256(
        `${model.id}\0${PROMPT_VERSION}\0${JSON.stringify(request)}`,
      );
      const hit = await store.get<unknown>(key);
      if (hit !== undefined) {
        onHit?.(key);
        return hit;
      }
      const answer = await model.complete(request);
      await store.put(key, answer);
      return answer;
    },
  };
}

export function usageLine(u: AiUsage): string {
  return [
    `${u.model}: ${u.inputTokens + u.cacheReadTokens + u.cacheWriteTokens} tokens in (${u.cacheReadTokens} from the cache), ${u.outputTokens} out, ${u.turns} ${u.turns === 1 ? "turn" : "turns"}`,
    u.costUsd === undefined ? undefined : `~${u.costUsd.toFixed(3)} USD`,
    ...u.notes,
  ]
    .filter(Boolean)
    .join(" · ");
}
