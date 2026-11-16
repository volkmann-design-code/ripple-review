import type {
  PullRequestSummary,
  RecentChange,
} from "@ripple-review/api-contract";

/*
 * Stacked pull requests: one whose base branch is another's head sits on
 * top of it, and is best reviewed after it. Built from a repository's open
 * pull requests.
 */

/** One pull request in a stack, in tree order, with what draws its tree lines. */
export interface StackRow {
  pr: PullRequestSummary;
  depth: number;
  /** Per ancestor level below the root: whether its line goes on (it has siblings after it). */
  rails: boolean[];
  /** The last on its parent: the connector ends here. */
  last: boolean;
  hasChildren: boolean;
  /**
   * Its base is neither the default branch nor an open pull request's head,
   * e.g. the one below was merged and its branch kept, or is not listed.
   */
  orphan: boolean;
}

export interface Stack {
  rows: StackRow[];
  /** The latest update of any pull request in it. */
  updatedAt: string;
}

/**
 * The stacks of one repository's open pull requests, most recently updated
 * first; pull requests on the same one by number. A pull request on its own
 * is a stack of one.
 */
export function buildStacks(prs: PullRequestSummary[]): Stack[] {
  const byHead = new Map(
    prs.filter((p) => p.head && !p.fromFork).map((p) => [p.head, p]),
  );
  const children = new Map<number, PullRequestSummary[]>();
  const roots: PullRequestSummary[] = [];
  for (const p of prs) {
    const parent = stacked(p) ? byHead.get(p.base) : undefined;
    if (parent && parent !== p) {
      children.set(parent.number, [...(children.get(parent.number) ?? []), p]);
    } else {
      roots.push(p);
    }
  }

  const seen = new Set<number>();
  const stacks = roots.map((root): Stack => {
    const rows: StackRow[] = [];
    const walk = (
      pr: PullRequestSummary,
      depth: number,
      rails: boolean[],
      last: boolean,
    ): void => {
      if (seen.has(pr.number)) {
        return; // a base/head cycle; GitHub doesn't allow one
      }
      seen.add(pr.number);
      const kids = (children.get(pr.number) ?? []).sort(
        (a, b) => a.number - b.number,
      );
      rows.push({
        pr,
        depth,
        rails,
        last,
        hasChildren: kids.length > 0,
        orphan: depth === 0 && stacked(pr),
      });
      const childRails = depth === 0 ? [] : [...rails, !last];
      kids.forEach((kid, i) => {
        walk(kid, depth + 1, childRails, i === kids.length - 1);
      });
    };
    walk(root, 0, [], true);
    return {
      rows,
      updatedAt:
        rows
          .map((r) => r.pr.updatedAt)
          .sort()
          .at(-1) ?? "",
    };
  });
  return stacks.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** The stack a pull request is in, if it is in one with others. */
export function stackOf(stacks: Stack[], number: number): Stack | undefined {
  return stacks.find(
    (s) => s.rows.length > 1 && s.rows.some((r) => r.pr.number === number),
  );
}

/** The reviewer's progress on a repository's pull requests opened here, by number. */
export function progressIn(
  recent: RecentChange[],
  owner: string,
  repo: string,
): Map<number, RecentChange> {
  return new Map(
    recent
      .filter((c) => c.ref.owner === owner && c.ref.repo === repo)
      .map((c) => [c.ref.number, c]),
  );
}

/** Its base is a branch other than the default one. */
function stacked(
  p: PullRequestSummary,
): p is PullRequestSummary & { base: string } {
  return Boolean(p.base && p.defaultBranch && p.base !== p.defaultBranch);
}
