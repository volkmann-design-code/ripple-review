import type { ApiError } from "@ripple-review/api-contract";
import type { EngineApi } from "./api";

/*
 * Messages between the page and the engine's worker: one request per call,
 * any number of stages, then a result or a failure, matched by `id`. A
 * method's last parameter, when it is a function, is its stage callback and
 * not sent.
 */

export type Method = keyof EngineApi;

type DataParams<F> = F extends (...args: infer A) => unknown
  ? A extends [...infer Rest, (stage: string) => void]
    ? Rest
    : A
  : never;

export type Args<M extends Method> = DataParams<EngineApi[M]>;
export type Result<M extends Method> = Awaited<ReturnType<EngineApi[M]>>;

export interface Request<M extends Method = Method> {
  id: number;
  method: M;
  args: Args<M>;
}

export type Reply =
  | { id: number; stage: string }
  | { id: number; result: unknown }
  | { id: number; failure: { status: number } & ApiError };
