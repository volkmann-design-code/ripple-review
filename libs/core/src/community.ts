export interface WeightedEdge {
  a: string;
  b: string;
  w: number;
}

/**
 * Louvain community detection on an undirected weighted graph (deterministic:
 * nodes are visited in the given order). Returns node → community index.
 */
export function louvain(
  nodes: string[],
  edges: WeightedEdge[],
  resolution = 1,
): Map<string, number> {
  // Current level: each "super node" holds a set of original nodes.
  let members: string[][] = nodes.map((n) => [n]);
  const index = new Map(nodes.map((n, i) => [n, i]));
  let adj: Map<number, number>[] = nodes.map(() => new Map());
  for (const e of edges) {
    const a = index.get(e.a);
    const b = index.get(e.b);
    if (a === undefined || b === undefined || a === b) {
      continue;
    }
    adj[a]!.set(b, (adj[a]!.get(b) ?? 0) + e.w);
    adj[b]!.set(a, (adj[b]!.get(a) ?? 0) + e.w);
  }
  const selfLoops: number[] = nodes.map(() => 0);
  let self = selfLoops;

  for (let level = 0; level < 10; level++) {
    const n = members.length;
    const k = adj.map(
      (m, i) => [...m.values()].reduce((s, w) => s + w, 0) + 2 * self[i]!,
    );
    const m2 = k.reduce((s, x) => s + x, 0);
    if (m2 === 0) {
      break;
    }
    const comm = members.map((_, i) => i);
    const tot = [...k];
    let moved = false;

    for (let pass = 0; pass < 20; pass++) {
      let changed = false;
      for (let i = 0; i < n; i++) {
        const ci = comm[i]!;
        const links = new Map<number, number>();
        for (const [j, w] of adj[i]!) {
          links.set(comm[j]!, (links.get(comm[j]!) ?? 0) + w);
        }
        tot[ci]! -= k[i]!;
        let best = ci;
        let bestGain =
          (links.get(ci) ?? 0) - (resolution * tot[ci]! * k[i]!) / m2;
        for (const [c, kin] of links) {
          const gain = kin - (resolution * tot[c]! * k[i]!) / m2;
          if (gain > bestGain + 1e-12) {
            [best, bestGain] = [c, gain];
          }
        }
        tot[best]! += k[i]!;
        if (best !== ci) {
          comm[i] = best;
          changed = moved = true;
        }
      }
      if (!changed) {
        break;
      }
    }
    if (!moved) {
      break;
    }

    // Aggregate communities into super nodes.
    const ids = [...new Set(comm)];
    const remap = new Map(ids.map((c, i) => [c, i]));
    const nextMembers: string[][] = ids.map(() => []);
    const nextAdj: Map<number, number>[] = ids.map(() => new Map());
    const nextSelf = ids.map(() => 0);
    for (let i = 0; i < n; i++) {
      const ci = remap.get(comm[i]!)!;
      nextMembers[ci]!.push(...members[i]!);
      nextSelf[ci]! += self[i]!;
      for (const [j, w] of adj[i]!) {
        const cj = remap.get(comm[j]!)!;
        if (ci === cj) {
          nextSelf[ci]! += w / 2;
        } else {
          nextAdj[ci]!.set(cj, (nextAdj[ci]!.get(cj) ?? 0) + w);
        }
      }
    }
    members = nextMembers;
    adj = nextAdj;
    self = nextSelf;
  }

  const result = new Map<string, number>();
  members.forEach((ms, c) => {
    for (const m of ms) {
      result.set(m, c);
    }
  });
  return result;
}

/**
 * A community that is not one in the weak sense (Radicchi et al.: the ties
 * among its files, counted from both ends, do not outweigh its ties outside
 * it) joins the community it is most strongly tied to; smallest first,
 * until none is left. Louvain leaves such communities behind: on a star (a migration and
 * the functions it includes) it splits off any two leaves that also link to
 * each other, though each is tied more to the hub. A single file with any
 * edge is the simplest case.
 */
export function mergeWeak(
  community: Map<string, number>,
  edges: WeightedEdge[],
): void {
  for (;;) {
    const members = new Map<number, string[]>();
    for (const [node, c] of [...community].sort((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      members.set(c, [...(members.get(c) ?? []), node]);
    }
    const inner = new Map<number, number>();
    const ties = new Map<number, Map<number, number>>();
    for (const e of edges) {
      const ca = community.get(e.a);
      const cb = community.get(e.b);
      if (ca === undefined || cb === undefined) {
        continue;
      }
      if (ca === cb) {
        inner.set(ca, (inner.get(ca) ?? 0) + e.w);
        continue;
      }
      for (const [from, to] of [
        [ca, cb],
        [cb, ca],
      ] as const) {
        const t = ties.get(from) ?? new Map<number, number>();
        t.set(to, (t.get(to) ?? 0) + e.w);
        ties.set(from, t);
      }
    }
    const weak = [...members]
      .filter(([c]) => {
        const outside = [...(ties.get(c)?.values() ?? [])].reduce(
          (s, w) => s + w,
          0,
        );
        return outside > 0 && 2 * (inner.get(c) ?? 0) <= outside;
      })
      .sort(
        (a, b) => a[1].length - b[1].length || a[1][0]!.localeCompare(b[1][0]!),
      )[0];
    if (!weak) {
      return;
    }
    const [c, nodes] = weak;
    const best = [...ties.get(c)!].sort((a, b) => b[1] - a[1])[0]![0];
    for (const n of nodes) {
      community.set(n, best);
    }
  }
}
