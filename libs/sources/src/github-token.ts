import { execFileSync } from "node:child_process";
import { ForgeError } from "@ripple-review/core/forge";

/**
 * The user's GitHub token on their own machine (the CLI):
 * `GITHUB_TOKEN` or `GH_TOKEN`, else the signed-in GitHub CLI's
 * (`gh auth token`). Read once per process.
 */
let cached: string | undefined;

export function githubToken(env = process.env): string {
  cached ??= env.GITHUB_TOKEN || env.GH_TOKEN || ghAuthToken();
  return cached;
}

function ghAuthToken(): string {
  try {
    return execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (err) {
    const e = err as { code?: string };
    throw e.code === "ENOENT"
      ? new ForgeError(
          401,
          "No GitHub token",
          "Set GITHUB_TOKEN, or install the GitHub CLI (https://cli.github.com) and run `gh auth login`.",
        )
      : new ForgeError(401, "gh is not signed in", "Run `gh auth login`.");
  }
}
