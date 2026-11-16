/*
 * Repository paths: always "/"-separated and relative to the root. Plain
 * string functions (no `node:path`), so the core runs in a browser too.
 */

/** POSIX `normalize`: resolves `.` and `..`, collapses slashes. */
function normalize(p: string): string {
  if (p === "") {
    return ".";
  }
  const absolute = p.startsWith("/");
  const out: string[] = [];
  for (const s of p.split("/")) {
    if (s === "" || s === ".") {
      continue;
    }
    if (s === "..") {
      if (out.length > 0 && out.at(-1) !== "..") {
        out.pop();
      } else if (!absolute) {
        out.push("..");
      }
    } else {
      out.push(s);
    }
  }
  const body = out.join("/");
  const n = absolute ? `/${body}` : body || ".";
  return p.endsWith("/") && n !== "/" ? `${n}/` : n;
}

/** Normalizes a repo-relative path; undefined if it escapes the repository root. */
export function normalizeRepoPath(p: string): string | undefined {
  const n = normalize(p).replace(/^\.\//, "");
  if (n === ".." || n.startsWith("../") || n.startsWith("/")) {
    return undefined;
  }
  return n;
}

/** The directory of a path, "" at the root. */
export function dirOf(p: string): string {
  const trimmed = p.length > 1 ? p.replace(/\/+$/, "") : p;
  const i = trimmed.lastIndexOf("/");
  if (i < 0) {
    return "";
  }
  return i === 0 ? "/" : trimmed.slice(0, i);
}

export function joinRepo(...parts: string[]): string | undefined {
  return normalizeRepoPath(parts.filter((p) => p !== "").join("/") || ".");
}
