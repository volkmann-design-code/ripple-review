import { ForgeError } from "@ripple-review/core/forge";

export interface GraphQLError {
  message: string;
  type?: string;
  path?: (string | number)[];
}

/** A GraphQL answer: data, and errors, which may come with partial data. */
export interface GraphQLBody<T> {
  data?: T;
  errors?: GraphQLError[];
}

/** Sends a query or mutation with variables; throws only when the request fails. */
export type GraphQL = <T>(
  query: string,
  variables: Record<string, unknown>,
) => Promise<GraphQLBody<T>>;

/** A GraphQL error in words the user can act on. */
export function graphqlError(errors: GraphQLError[], what: string): ForgeError {
  const message = errors.map((e) => e.message).join("; ") || "no data";
  if (
    errors.some(
      (e) =>
        e.type === "FORBIDDEN" ||
        /not accessible by|permission/i.test(e.message),
    )
  ) {
    return new ForgeError(
      403,
      `GitHub didn't let the token ${what === "answer" ? "do that" : what}`,
      `Fine-grained tokens need write access to "Pull requests" for that (classic ones the "repo" scope). GitHub said: ${message}`,
    );
  }
  if (errors.some((e) => e.type === "NOT_FOUND")) {
    return new ForgeError(404, `GitHub: ${message}`);
  }
  if (
    errors.some((e) => e.type === "UNPROCESSABLE" || e.type === "VALIDATION")
  ) {
    return new ForgeError(
      422,
      `GitHub didn't ${what === "answer" ? "do that" : what}: ${message}`,
    );
  }
  return new ForgeError(502, `GitHub GraphQL: ${message}`);
}
