import type { Edge, ReviewGroup } from "@ripple-review/core/model";

/**
 * Numbers about one review order that need no reference order (D15). They say
 * how much structure the tool found, not whether the order is right; the
 * user's notes say that.
 */
export interface Measures {
  files: number;
  groups: number;
  stories: number;
  /** Files in "Standalone changes", as a share of the reviewed files. */
  standalone: number;
  /**
   * Tests inside a story or its mechanical edits, as a share of all tests;
   * undefined without tests.
   */
  testsPlaced: number | undefined;
  mechanical: number;
  /** Reviewed files no edge touches, as a share of the reviewed files. */
  unlinked: number;
}

/** Reviewed = everything outside the docs and generated groups. */
export function measure(groups: ReviewGroup[], edges: Edge[]): Measures {
  const reviewed = groups
    .filter((g) => g.kind !== "generated" && g.kind !== "context")
    .flatMap((g) => g.items);
  const linked = new Set(edges.flatMap((e) => [e.from, e.to]));
  const tests = groups.flatMap((g) =>
    g.items
      .filter((it) => it.role === "test")
      .map(() => g.kind === "story" || g.kind === "mechanical"),
  );
  const share = (n: number, of: number) => (of === 0 ? 0 : n / of);
  return {
    files: groups.reduce((s, g) => s + g.items.length, 0),
    groups: groups.length,
    stories: groups.filter((g) => g.kind === "story").length,
    standalone: share(
      groups
        .filter((g) => g.section === "standalone")
        .reduce((s, g) => s + g.items.length, 0),
      reviewed.length,
    ),
    testsPlaced:
      tests.length === 0
        ? undefined
        : share(tests.filter(Boolean).length, tests.length),
    mechanical: groups.filter((g) => g.kind === "mechanical").length,
    unlinked: share(
      reviewed.filter((it) => !linked.has(it.path)).length,
      reviewed.length,
    ),
  };
}
