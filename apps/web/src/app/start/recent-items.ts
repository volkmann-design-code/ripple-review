import type {
  PullRequestSummary,
  RecentChange,
} from "@ripple-review/api-contract";
import { labelOf } from "../core/refs";
import { buildStacks, type Stack, stackOf } from "../core/stacks";

/** A row of "Recently viewed": a change, or the stack of one. */
export type RecentItem =
  | { key: string; change: RecentChange; stack?: undefined }
  | {
      key: string;
      stack: Stack;
      owner: string;
      repo: string;
      openedAt: string;
      change?: undefined;
    };

/**
 * "Recently viewed", with a change in a stack shown as its whole stack:
 * once, where its most recently viewed one is. `pulls` are the open pull
 * requests by `owner/repo`; a repository without them gives plain rows.
 */
export function recentItems(
  recent: RecentChange[],
  pulls: ReadonlyMap<string, PullRequestSummary[]>,
): RecentItem[] {
  const shown = new Set<Stack>();
  const stacksOf = new Map<string, Stack[]>();
  const items: RecentItem[] = [];
  for (const c of recent) {
    const repo = `${c.ref.owner}/${c.ref.repo}`;
    const open = pulls.get(repo);
    let stacks = stacksOf.get(repo);
    if (open && !stacks) {
      stacks = buildStacks(open);
      stacksOf.set(repo, stacks);
    }
    const stack = stacks && stackOf(stacks, c.ref.number);
    if (!stack) {
      items.push({ key: labelOf(c.ref), change: c });
    } else if (!shown.has(stack)) {
      shown.add(stack);
      items.push({
        key: `${repo}#stack-${stack.rows[0]?.pr.number}`,
        stack,
        owner: c.ref.owner,
        repo: c.ref.repo,
        openedAt: c.openedAt,
      });
    }
  }
  return items;
}
