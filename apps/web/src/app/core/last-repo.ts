/*
 * The repository whose open pull requests were listed last on the start
 * page, kept in localStorage (a convenience: it can be unavailable in
 * private windows or with blocked site data).
 */

const KEY = "ripple-review.lastRepo";

export function lastRepo(): string | undefined {
  try {
    return localStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function setLastRepo(repo: string): void {
  try {
    localStorage.setItem(KEY, repo);
  } catch {
    // Only a convenience.
  }
}

export function forgetLastRepo(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing kept.
  }
}
