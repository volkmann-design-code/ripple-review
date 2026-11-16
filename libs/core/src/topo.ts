/**
 * Topological order of `ids` along `edges` (from before to). Cycles are
 * collapsed into strongly connected components; among the components that are
 * ready, the one with the smallest key goes first, and inside a component the
 * members are sorted by key.
 */
export function topoOrder(
  ids: string[],
  edges: { from: string; to: string }[],
  compare: (a: string, b: string) => number,
): string[] {
  const idSet = new Set(ids);
  const succ = new Map<string, string[]>(ids.map((i) => [i, []]));
  for (const e of edges) {
    if (idSet.has(e.from) && idSet.has(e.to) && e.from !== e.to) {
      succ.get(e.from)!.push(e.to);
    }
  }

  // Tarjan's SCC
  let index = 0;
  const idx = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const compOf = new Map<string, number>();
  const comps: string[][] = [];
  const strong = (v: string) => {
    idx.set(v, index);
    low.set(v, index++);
    stack.push(v);
    onStack.add(v);
    for (const w of succ.get(v)!) {
      if (!idx.has(w)) {
        strong(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, idx.get(w)!));
      }
    }
    if (low.get(v) === idx.get(v)) {
      const comp: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        compOf.set(w, comps.length);
        comp.push(w);
      } while (w !== v);
      comps.push(comp.sort(compare));
    }
  };
  for (const v of [...ids].sort(compare)) {
    if (!idx.has(v)) {
      strong(v);
    }
  }

  // Kahn over the condensation, smallest ready component first.
  const indeg = comps.map(() => 0);
  const csucc = comps.map(() => new Set<number>());
  for (const [v, ws] of succ) {
    for (const w of ws) {
      const a = compOf.get(v)!;
      const b = compOf.get(w)!;
      if (a !== b && !csucc[a]!.has(b)) {
        csucc[a]!.add(b);
        indeg[b]!++;
      }
    }
  }
  const ready = comps.map((_, i) => i).filter((i) => indeg[i] === 0);
  const order: string[] = [];
  while (ready.length > 0) {
    ready.sort((a, b) => compare(comps[a]![0]!, comps[b]![0]!));
    const c = ready.shift()!;
    order.push(...comps[c]!);
    for (const d of csucc[c]!) {
      if (--indeg[d]! === 0) {
        ready.push(d);
      }
    }
  }
  return order;
}
