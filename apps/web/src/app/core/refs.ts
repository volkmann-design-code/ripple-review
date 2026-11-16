import type { ChangeRef } from "@ripple-review/api-contract";

/**
 * Reads what a user pastes: a pull request URL, `owner/repo#12` or
 * `owner/repo/pull/12`.
 */
export function parseRef(input: string): ChangeRef | undefined {
  const s = input.trim();
  const m =
    /github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)/.exec(s) ??
    /^([\w.-]+)\/([\w.-]+)(?:#|\/pull\/)(\d+)$/.exec(s);
  return m?.[1] && m[2] && m[3]
    ? { kind: "github", owner: m[1], repo: m[2], number: Number(m[3]) }
    : undefined;
}

/** `owner/repo` of a repository field. */
export function parseRepo(
  input: string,
): { owner: string; repo: string } | undefined {
  const m =
    /github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(input.trim()) ??
    /^([\w.-]+)\/([\w.-]+)$/.exec(input.trim());
  return m?.[1] && m[2] ? { owner: m[1], repo: m[2] } : undefined;
}

/** The app's route for a change: mirrors GitHub's URL path. */
export function routeOf(ref: ChangeRef): string[] {
  return ["/", ref.owner, ref.repo, "pull", String(ref.number)];
}

export function labelOf(ref: ChangeRef): string {
  return `${ref.owner}/${ref.repo}#${ref.number}`;
}
