import { ROLE_RANK } from "./classify.ts";
import { louvain, mergeWeak, type WeightedEdge } from "./community.ts";
import type { Analysis } from "./graph.ts";
import { findMechanical, type MechanicalGroup } from "./mechanical.ts";
import type {
  Edge,
  EdgeKind,
  FileNode,
  ReviewGroup,
  ReviewItem,
  Role,
} from "./model.ts";
import { dirOf } from "./paths.ts";
import { topoOrder } from "./topo.ts";

const isGenerated = (r: Role) => r === "generated" || r === "lockfile";
const isTest = (r: Role) => r === "test" || r === "test-support";
const basename = (p: string) => p.slice(p.lastIndexOf("/") + 1);

const EDGE_WEIGHT: Record<EdgeKind, number> = {
  import: 1,
  contains: 1,
  framework: 1,
  "via-generated": 0.75,
  name: 0.5,
};

/**
 * Uses of a file shared by many say little about which story a user belongs
 * to (everything imports the core types): an edge of these kinds out of a
 * file with more than HUB dependents counts HUB/n. Dependents are counted as
 * nodes of the graph being clustered: a mechanical group is one node, so its
 * files' dependents add up, and files of one group count once. Containment and framework
 * conventions (a migration and the functions it includes) say where a file
 * belongs, however many there are, and keep their weight.
 */
const DAMPED = new Set<EdgeKind>(["import", "name", "via-generated"]);
const HUB = 3;

interface Story {
  members: string[];
  mechanical: MechanicalGroup[];
}

/**
 * Turns the analysis into review groups:
 *   context (docs) → repository config (setup for what follows) → stories in
 *   dependency order (each followed by its mechanical edits) → standalone
 *   files → new tests of unchanged code, per project → generated.
 * Inside a story: hand-written code in dependency order, then test support, then tests.
 */
export function planReview(analysis: Analysis): {
  groups: ReviewGroup[];
  edges: Edge[];
} {
  const { nodes } = analysis;
  const role = (p: string) => nodes.get(p)!.role;
  const edges = effectiveEdges(analysis);

  const all = [...nodes.values()];
  const docs = all.filter((n) => n.role === "docs").map((n) => n.file.path);
  const generated = all
    .filter((n) => isGenerated(n.role))
    .map((n) => n.file.path);
  const mechanical = findMechanical(
    all.filter((n) => !isGenerated(n.role) && n.role !== "docs"),
  );
  const mechOf = new Map<string, number>();
  mechanical.forEach((g, i) => {
    for (const f of g.files) {
      mechOf.set(f, i);
    }
  });
  const rest = all
    .map((n) => n.file.path)
    .filter(
      (p) => role(p) !== "docs" && !isGenerated(role(p)) && !mechOf.has(p),
    );
  const config = rest.filter((p) => role(p) === "config");
  const tests = rest.filter((p) => isTest(role(p)));
  const code = rest.filter((p) => role(p) !== "config" && !isTest(role(p)));

  // ── Stories: communities of the code dependency graph ─────────────────────
  // A mechanical group joins the clustering as one node, so a refactor and its
  // ripple through the codebase end up in the same story.
  const clusterId = (p: string) =>
    mechOf.has(p) ? `mech:${mechOf.get(p)}` : p;
  const clusterNodes = [...code, ...mechanical.map((_, i) => `mech:${i}`)];
  const inCluster = new Set(clusterNodes);
  const fanout = new Map<string, Set<string>>();
  for (const e of edges) {
    const a = clusterId(e.from);
    const b = clusterId(e.to);
    if (a !== b && inCluster.has(a) && inCluster.has(b) && DAMPED.has(e.kind)) {
      fanout.set(a, (fanout.get(a) ?? new Set()).add(b));
    }
  }
  const weighted: WeightedEdge[] = [];
  for (const e of edges) {
    const a = clusterId(e.from);
    const b = clusterId(e.to);
    if (a !== b && inCluster.has(a) && inCluster.has(b)) {
      const w = EDGE_WEIGHT[e.kind];
      weighted.push({
        a,
        b,
        w: DAMPED.has(e.kind)
          ? w * Math.min(1, HUB / (fanout.get(a)?.size ?? 1))
          : w,
      });
    }
  }
  const community = louvain(clusterNodes, weighted);
  mergeWeak(community, weighted);

  const stories = new Map<number, Story>();
  const storyOf = (c: number) => {
    let s = stories.get(c);
    if (!s) {
      s = { members: [], mechanical: [] };
      stories.set(c, s);
    }
    return s;
  };
  for (const n of clusterNodes) {
    const s = storyOf(community.get(n)!);
    if (n.startsWith("mech:")) {
      s.mechanical.push(mechanical[Number(n.slice(5))]!);
    } else {
      s.members.push(n);
    }
  }

  // Tests go with the story they exercise most.
  const weightTo = (p: string) => {
    const w = new Map<number, number>();
    for (const e of edges) {
      const other = e.from === p ? e.to : e.to === p ? e.from : undefined;
      const c =
        other === undefined ? undefined : community.get(clusterId(other));
      if (c !== undefined) {
        w.set(c, (w.get(c) ?? 0) + EDGE_WEIGHT[e.kind]);
      }
    }
    return [...w].sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  let nextId = Math.max(-1, ...community.values()) + 1;
  // Tests first, then the helpers - a helper goes where the tests using it went.
  const assign = (t: string) => {
    const c = weightTo(t);
    if (c === undefined) {
      return false;
    }
    community.set(t, c);
    storyOf(c).members.push(t);
    return true;
  };
  let pending = [...tests].sort(
    (a, b) => ROLE_RANK[role(b)] - ROLE_RANK[role(a)],
  );
  for (let round = 0; round < 3 && pending.length > 0; round++) {
    pending = pending.filter((t) => !assign(t));
  }
  for (const t of pending) {
    community.set(t, nextId);
    storyOf(nextId++).members.push(t);
  }

  // Config files go with the story living under their directory, counting
  // its mechanical edits (a build script and the package.json that runs it).
  const misc: string[] = [];
  for (const c of config) {
    const dir = dirOf(c);
    let best: Story | undefined;
    let bestCount = 0;
    if (dir) {
      for (const s of stories.values()) {
        const count = [
          ...s.members,
          ...s.mechanical.flatMap((g) => g.files),
        ].filter((m) => m.startsWith(`${dir}/`)).length;
        if (count > bestCount) {
          [best, bestCount] = [s, count];
        }
      }
    }
    if (best) {
      best.members.push(c);
    } else {
      misc.push(c);
    }
  }

  // ── Order the stories by their dependencies ───────────────────────────────
  const storyKey = new Map<string, Story>();
  const keyOf = new Map<string, string>();
  for (const [c, s] of stories) {
    storyKey.set(`s${c}`, s);
    for (const m of s.members) {
      keyOf.set(m, `s${c}`);
    }
    for (const g of s.mechanical) {
      for (const f of g.files) {
        keyOf.set(f, `s${c}`);
      }
    }
  }
  const churn = (s: Story) =>
    [...s.members, ...s.mechanical.flatMap((g) => g.files)].reduce(
      (sum, m) =>
        sum + nodes.get(m)!.file.additions + nodes.get(m)!.file.deletions,
      0,
    );
  const rank = (key: string) =>
    Math.min(
      ...(storyKey.get(key)?.members ?? []).map((m) => ROLE_RANK[role(m)]),
    );
  // Story-level dependencies: code only (tests depend on everything), and where
  // two stories depend on each other, the heavier direction wins.
  const storyWeight = new Map<string, number>();
  for (const e of edges) {
    if (isTest(role(e.from)) || isTest(role(e.to))) {
      continue;
    }
    const a = keyOf.get(e.from);
    const b = keyOf.get(e.to);
    if (!a || !b || a === b) {
      continue;
    }
    storyWeight.set(
      `${a}\0${b}`,
      (storyWeight.get(`${a}\0${b}`) ?? 0) + EDGE_WEIGHT[e.kind],
    );
  }
  const storyEdges = [...storyWeight]
    .map(([k, w]) => {
      const [from, to] = k.split("\0") as [string, string];
      return { from, to, w };
    })
    .filter((e) => {
      const back = storyWeight.get(`${e.to}\0${e.from}`) ?? 0;
      // A tie goes to the story with the more basic files (schema before source).
      return e.w > back || (e.w === back && rank(e.from) <= rank(e.to));
    });
  const onlyTests = (s: Story) => s.members.every((m) => isTest(role(m)));
  const storyOrder = topoOrder([...storyKey.keys()], storyEdges, (a, b) => {
    const sa = storyKey.get(a)!;
    const sb = storyKey.get(b)!;
    return (
      Number(onlyTests(sa)) - Number(onlyTests(sb)) ||
      Number(sa.members.length <= 1) - Number(sb.members.length <= 1) ||
      // Independent stories: the more basic first (schema before UI), then the smaller.
      rank(a) - rank(b) ||
      churn(sa) - churn(sb)
    );
  });

  // ── Build the groups ──────────────────────────────────────────────────────
  const fileCompare = (a: string, b: string) =>
    ROLE_RANK[role(a)] - ROLE_RANK[role(b)] || a.localeCompare(b);
  const item = (p: string): ReviewItem => {
    const f = nodes.get(p)!.file;
    return {
      path: p,
      role: role(p),
      additions: f.additions,
      deletions: f.deletions,
      status: f.status,
      notes: [],
    };
  };
  const groups: ReviewGroup[] = [];
  if (docs.length > 0) {
    groups.push({
      kind: "context",
      title: "Context: read first",
      items: docs.sort().map(item),
    });
  }

  if (misc.length > 0) {
    groups.push({
      kind: "misc",
      title: "Repository config",
      section: "config",
      items: misc.sort().map(item),
    });
  }

  // A part whose host went into a same-edit group (a template whose
  // component got the same new import as twenty others) is read after
  // that group, not before its component.
  const hostOf = soleHosts(edges);
  const standalone: string[] = [];
  for (const key of storyOrder) {
    const s = storyKey.get(key)!;
    if (s.members.length === 1 && s.mechanical.length === 0) {
      standalone.push(s.members[0]!);
      continue;
    }
    const byRole = (pred: (r: Role) => boolean, from = s.members) =>
      from.filter((m) => pred(role(m)));
    const deferred = s.members.filter((m) => {
      const h = hostOf.get(m);
      return h !== undefined && mechOf.has(h) && !isTest(role(m));
    });
    const before = s.members.filter((m) => !deferred.includes(m));
    const code = orderWithParts(
      byRole((r) => !isTest(r), before),
      edges,
      fileCompare,
    );
    const tests = [
      ...orderWithParts(
        byRole((r) => r === "test-support"),
        edges,
        fileCompare,
      ),
      ...orderWithParts(
        byRole((r) => r === "test"),
        edges,
        fileCompare,
      ),
    ];
    const first = deferred.length ? code : [...code, ...tests];
    const firstTitle = first.length
      ? storyTitle(first, edges, nodes)
      : undefined;
    if (first.length > 0) {
      groups.push({
        kind: "story",
        title: firstTitle!,
        items: first.map(item),
      });
    }
    for (const g of mechanicalInOrder(s.mechanical, edges)) {
      groups.push({
        kind: "mechanical",
        title: g.newFiles
          ? `Same new file in ${g.files.length} places, starting \`${g.lines[0] ?? ""}\``
          : `Same edit in ${g.files.length} files: ${g.lines.map((l) => `\`${l}\``).join(" ")}`,
        items: g.files.map(item),
      });
    }
    if (deferred.length > 0) {
      const rest = [...orderWithParts(deferred, edges, fileCompare), ...tests];
      groups.push({
        kind: "story",
        title: firstTitle
          ? `${firstTitle}, continued`
          : storyTitle(rest, edges, nodes),
        items: rest.map(item),
      });
    }
  }
  // New tests of code the change leaves alone: grouped by project, so a
  // test-only push reads as "tests for libs/core", not as loose files.
  const testsByProject = new Map<string, string[]>();
  for (const p of standalone) {
    if (isTest(role(p))) {
      const key = projectOf(p);
      testsByProject.set(key, [...(testsByProject.get(key) ?? []), p]);
    }
  }
  const testGroups = [...testsByProject]
    .filter(([, files]) => files.length >= 2)
    .sort(([a], [b]) => a.localeCompare(b));
  const grouped = new Set(testGroups.flatMap(([, files]) => files));
  const loose = standalone.filter((p) => !grouped.has(p));
  if (loose.length > 0) {
    groups.push({
      kind: "misc",
      title: "Standalone changes",
      section: "standalone",
      items: loose.sort(fileCompare).map(item),
    });
  }
  for (const [project, files] of testGroups) {
    groups.push({
      kind: "misc",
      title: project ? `Tests in \`${project}\`` : "Tests",
      section: "tests",
      items: files.sort(fileCompare).map(item),
    });
  }
  if (generated.length > 0) {
    groups.push({
      kind: "generated",
      title:
        "Generated: check it matches its source, don't review line by line",
      items: generated.sort().map(item),
    });
  }

  annotate(groups, edges);
  return { groups, edges };
}

/**
 * Dependency order of `ids`, a file and the parts it contains read as one:
 * an Angular component, then its template and styles; a migration, then
 * the files it includes. The unit goes where its files' dependencies put it
 * (a template binding another component puts that component first); inside
 * it the host comes first, then its parts in dependency order, as the host
 * lists them where that leaves a choice. A part of several hosts (a
 * snippet every template includes) stays loose, read after all of them.
 */
export function orderWithParts(
  ids: string[],
  edges: Edge[],
  compare: (a: string, b: string) => number,
): string[] {
  const inSet = new Set(ids);
  const hosts = new Map<string, Set<string>>();
  for (const e of edges) {
    if (
      e.kind === "contains" &&
      e.from !== e.to &&
      inSet.has(e.from) &&
      inSet.has(e.to)
    ) {
      hosts.set(e.to, (hosts.get(e.to) ?? new Set()).add(e.from));
    }
  }
  const hostOf = new Map<string, string>();
  const listed = new Map<string, number>();
  for (const [part, hs] of hosts) {
    if (hs.size === 1) {
      hostOf.set(part, [...hs][0]!);
      listed.set(part, listed.size);
    }
  }
  if (hostOf.size === 0) {
    return topoOrder(ids, edges, compare);
  }
  // Nested parts (an include that includes) belong to the outermost host;
  // a cycle of hosts stops at the file it started from.
  const unitOf = (p: string) => {
    const seen = new Set([p]);
    let u = p;
    for (let h = hostOf.get(u); h && !seen.has(h); h = hostOf.get(u)) {
      seen.add(h);
      u = h;
    }
    return u;
  };
  const members = new Map<string, string[]>();
  for (const p of ids) {
    const u = unitOf(p);
    members.set(u, [...(members.get(u) ?? []), p]);
  }
  const units = [...members.keys()];
  const unitEdges = edges.flatMap((e) =>
    inSet.has(e.from) && inSet.has(e.to)
      ? [{ from: unitOf(e.from), to: unitOf(e.to) }]
      : [],
  );
  const byListing = (a: string, b: string) =>
    (listed.get(a) ?? -1) - (listed.get(b) ?? -1) || compare(a, b);
  return topoOrder(units, unitEdges, compare).flatMap((u) => {
    const ms = members.get(u)!;
    if (ms.length === 1) {
      return ms;
    }
    // In a cycle of hosts, the unit's name may be a member of another unit.
    return [
      ...(ms.includes(u) ? [u] : []),
      ...topoOrder(
        ms.filter((m) => m !== u),
        edges,
        byListing,
      ),
    ];
  });
}

/** Each file contained by exactly one other, with that host. */
function soleHosts(edges: Edge[]): Map<string, string> {
  const hosts = new Map<string, Set<string>>();
  for (const e of edges) {
    if (e.kind === "contains" && e.from !== e.to) {
      hosts.set(e.to, (hosts.get(e.to) ?? new Set()).add(e.from));
    }
  }
  return new Map(
    [...hosts].flatMap(([p, hs]) => (hs.size === 1 ? [[p, [...hs][0]!]] : [])),
  );
}

/**
 * A story's same-edit groups, the one with the hosts before the one with
 * their parts: the components' new import, then the templates' new pipe.
 */
function mechanicalInOrder(
  groups: MechanicalGroup[],
  edges: Edge[],
): MechanicalGroup[] {
  if (groups.length < 2) {
    return groups;
  }
  const groupOf = new Map<string, string>();
  groups.forEach((g, i) => {
    for (const f of g.files) {
      groupOf.set(f, String(i));
    }
  });
  const between = edges.flatMap((e) => {
    const a = groupOf.get(e.from);
    const b = groupOf.get(e.to);
    return e.kind === "contains" && a && b && a !== b
      ? [{ from: a, to: b }]
      : [];
  });
  return topoOrder(
    groups.map((_, i) => String(i)),
    between,
    (a, b) => Number(a) - Number(b),
  ).map((i) => groups[Number(i)]!);
}

/** Short reasons, from the edges into each item from earlier ones. */
function annotate(groups: ReviewGroup[], edges: Edge[]): void {
  const items = groups.flatMap((g) => g.items);
  const position = new Map(items.map((it, i) => [it.path, i]));
  const earlier = (e: Edge) => position.get(e.from)! < position.get(e.to)!;
  const kindOrder: EdgeKind[] = [
    "contains",
    "import",
    "framework",
    "via-generated",
    "name",
  ];

  for (const it of items) {
    const incoming = edges
      .filter((e) => e.to === it.path && earlier(e))
      .sort(
        (a, b) =>
          kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind) ||
          b.via.length - a.via.length,
      );
    const later = new Set(
      edges.filter((e) => e.from === it.path && !earlier(e)).map((e) => e.to),
    );
    if (later.size >= 2) {
      it.notes.push(`needed by ${later.size} later files`);
    }
    for (const e of incoming.slice(0, 2)) {
      const names = e.via
        .filter((v) => v !== "*")
        .slice(0, 3)
        .map((v) => `\`${v}\``);
      const from = basename(e.from);
      const by = e.framework ? ` (${e.framework})` : "";
      if (e.kind === "contains") {
        // "included by" says it already; the framework would only repeat it.
        it.notes.push(`included by ${from}`);
      } else if (e.kind === "framework") {
        it.notes.push(`${e.via[0]} ${from}${by}`);
      } else if (it.role === "wiring") {
        it.notes.push(`re-exports ${from}`);
      } else if (e.kind === "name") {
        it.notes.push(`mentions ${names.join(", ")} from ${from}${by}`);
      } else if (e.kind === "via-generated") {
        it.notes.push(
          `uses ${names.length ? `${names.join(", ")} ` : ""}generated from ${from}`,
        );
      } else {
        it.notes.push(
          names.length
            ? `uses ${names.join(", ")} from ${from}`
            : `imports ${from}`,
        );
      }
    }
    const rest = incoming.length - 2;
    if (rest > 0) {
      it.notes.push(`+${rest} more`);
    }
  }
}

/**
 * Edges between hand-written files. A generated file between two of them
 * (SQL function → generated row type → TS caller) becomes a direct edge.
 */
function effectiveEdges({ nodes, edges }: Analysis): Edge[] {
  const role = (p: string) => nodes.get(p)!.role;
  const plain = (p: string) => !isGenerated(role(p)) && role(p) !== "docs";
  const kept = edges.filter((e) => plain(e.from) && plain(e.to));
  const out = new Map<string, Edge[]>();
  for (const e of edges) {
    out.set(e.from, [...(out.get(e.from) ?? []), e]);
  }

  const bridged = new Map<string, Edge>();
  for (const [start] of nodes) {
    if (!plain(start)) {
      continue;
    }
    const seen = new Set<string>();
    const queue = (out.get(start) ?? [])
      .filter((e) => isGenerated(role(e.to)))
      .map((e) => e.to);
    while (queue.length > 0) {
      const g = queue.shift()!;
      if (seen.has(g)) {
        continue;
      }
      seen.add(g);
      // Leave generated code only along real imports: a dump that merely
      // mentions names is not a dependency.
      for (const e of out.get(g) ?? []) {
        if (e.kind !== "import") {
          continue;
        }
        if (isGenerated(role(e.to))) {
          queue.push(e.to);
        } else if (e.to !== start && plain(e.to)) {
          const key = `${start}\0${e.to}`;
          const b = bridged.get(key);
          if (b) {
            b.via.push(...e.via.filter((v) => !b.via.includes(v)));
          } else {
            bridged.set(key, {
              from: start,
              to: e.to,
              kind: "via-generated",
              via: [...e.via],
            });
          }
        }
      }
    }
  }
  const direct = new Set(kept.map((e) => `${e.from}\0${e.to}`));
  return [
    ...kept,
    ...[...bridged.values()].filter((e) => !direct.has(`${e.from}\0${e.to}`)),
  ];
}

/** Monorepo convention: `libs/core/…` → `libs/core`; otherwise the top directory. */
const WORKSPACE_DIRS = new Set([
  "apps",
  "libs",
  "packages",
  "services",
  "tools",
  "modules",
  "plugins",
  "crates",
]);
function projectOf(path: string): string {
  const parts = path.split("/").slice(0, -1);
  const [top, second] = parts;
  if (top === undefined) {
    return "";
  }
  return WORKSPACE_DIRS.has(top) && second !== undefined
    ? `${top}/${second}`
    : top;
}

function storyTitle(
  ordered: string[],
  edges: Edge[],
  nodes: Map<string, FileNode>,
): string {
  const inStory = new Set(ordered);
  const fanOut = new Map<string, number>();
  for (const e of edges) {
    if (inStory.has(e.from) && inStory.has(e.to)) {
      fanOut.set(e.from, (fanOut.get(e.from) ?? 0) + 1);
    }
  }
  const top = [...fanOut]
    .filter(([p]) => !isTest(nodes.get(p)!.role))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([p]) => p);
  const clash = (p: string) =>
    top.filter((q) => basename(q) === basename(p)).length > 1;
  const anchors = top.map(
    (p) => `\`${clash(p) ? p.split("/").slice(-2).join("/") : basename(p)}\``,
  );
  const areas = [
    ...new Set(ordered.map((p) => p.split("/").slice(0, 2).join("/"))),
  ];
  const where =
    areas.length <= 3
      ? areas.join(", ")
      : `${areas.slice(0, 3).join(", ")} +${areas.length - 3}`;
  return anchors.length ? `Around ${anchors.join(", ")} (${where})` : where;
}
