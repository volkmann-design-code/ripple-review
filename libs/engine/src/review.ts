import { type AnalysisStep, analyze } from "@ripple-review/core/graph";
import type { ChangeSet } from "@ripple-review/core/model";
import { planReview } from "@ripple-review/core/order";
import { defaultAdapters } from "./adapters.ts";

/** A step of `review`: the analysis', then the ordering. */
export type ReviewStep = AnalysisStep | { step: "order" };

/** Analyzes a change with the default adapters and plans its review order. */
export async function review(
  cs: ChangeSet,
  onStep: (s: ReviewStep) => void = () => {},
) {
  const analysis = await analyze(cs, defaultAdapters(), onStep);
  onStep({ step: "order" });
  return { analysis, ...planReview(analysis) };
}
