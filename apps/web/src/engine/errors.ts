import type { ApiError } from "@ripple-review/api-contract";
import { ForgeError } from "@ripple-review/core/forge";

/** A failure with the status and hint the user should see. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly hint?: string,
  ) {
    super(message);
  }
}

/** Any error as the app shows it (forge errors keep their status); unexpected ones are 500s. */
export function failureOf(err: unknown): { status: number } & ApiError {
  return err instanceof AppError || err instanceof ForgeError
    ? {
        status: err.status,
        error: err.message,
        ...(err.hint ? { hint: err.hint } : {}),
      }
    : { status: 500, error: err instanceof Error ? err.message : String(err) };
}
