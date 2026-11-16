/** A failure of the engine, with its message and hint. No Angular here, so it can be tested plainly. */
export class ApiFailure extends Error {
  constructor(
    message: string,
    readonly hint?: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
