import { parseUnifiedDiff } from "@ripple-review/core/diff";
import type { ChangeSet } from "@ripple-review/core/model";
import { GitSnapshot, git } from "./git.ts";

/** A change between two revisions of a local repository (diffed from their merge base). */
export function loadLocal(repo: string, base: string, head: string): ChangeSet {
  const headOid = git(repo, ["rev-parse", head]).trim();
  const patch = git(repo, [
    "diff",
    "--no-color",
    "--no-ext-diff",
    "-M",
    `${base}...${headOid}`,
  ]);
  return {
    title: `${base}...${head}`,
    head: new GitSnapshot(repo, headOid),
    files: parseUnifiedDiff(patch),
    patch,
  };
}
