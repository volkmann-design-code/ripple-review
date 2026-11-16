import type { ChangeRef, CommentAnchor } from "@ripple-review/api-contract";
import { AppError } from "./errors";

/*
 * What the page sends the engine, checked: it crosses the worker boundary,
 * so it is not trusted to have the types it claims.
 */

const NAME = /^[\w.-]+$/;

/** A repository's owner and name: letters, digits, `.`, `_` and `-`. */
export function repoChecked(owner: string, repo: string): void {
  if (!NAME.test(owner) || !NAME.test(repo)) {
    throw new AppError(400, "Not a repository");
  }
}

/** A GitHub pull request: its repository and a positive number. */
export function checked(ref: ChangeRef): ChangeRef {
  const ok =
    ref?.kind === "github" &&
    NAME.test(ref.owner) &&
    NAME.test(ref.repo) &&
    Number.isInteger(ref.number) &&
    ref.number > 0;
  if (!ok) {
    throw new AppError(400, "Not a pull request");
  }
  return ref;
}

/** A comment's text: not empty. */
export function text(body: string): string {
  const s = String(body);
  if (!s.trim()) {
    throw new AppError(400, "A comment needs some text");
  }
  return s;
}

/** An anchor as the page sent it, checked: a path, and whole positive lines. */
export function anchorOf(a: CommentAnchor): CommentAnchor {
  const line = (n: unknown) => Number.isInteger(n) && (n as number) > 0;
  const side = (s: unknown) => s === "old" || s === "new";
  if (
    typeof a?.path !== "string" ||
    !a.path ||
    (a.line !== undefined && (!line(a.line) || !side(a.side))) ||
    (a.startLine !== undefined &&
      (a.line === undefined || !line(a.startLine) || !side(a.startSide)))
  ) {
    throw new AppError(400, "Not a place for a comment");
  }
  return {
    path: a.path,
    ...(a.line !== undefined ? { line: a.line, side: a.side } : {}),
    ...(a.startLine !== undefined && a.startLine !== a.line
      ? { startLine: a.startLine, startSide: a.startSide }
      : {}),
  };
}
