import type { Edge, GroupKind, ReviewGroup, ReviewItem } from "../model.ts";
import type { AiAnswer, AiWeakEdge } from "./port.ts";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const records = (v: unknown) => (Array.isArray(v) ? v.filter(isRecord) : []);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const int = (v: unknown) => (Number.isInteger(v) ? (v as number) : -1);

/** Reads an answer leniently: malformed entries are dropped, not fatal. */
export function parseAnswer(raw: unknown): AiAnswer {
  const r = isRecord(raw) ? raw : {};
  return {
    order: Array.isArray(r.order)
      ? r.order.filter((v): v is number => Number.isInteger(v))
      : [],
    groups: records(r.groups)
      .map((g) => ({
        id: int(g.id),
        title: str(g.title),
        purpose: str(g.purpose),
      }))
      .filter((g) => g.id >= 0),
    moves: records(r.moves)
      .map((m) => ({ path: str(m.path), to: int(m.to), reason: str(m.reason) }))
      .filter((m) => m.path && m.to >= 0),
    weakEdges: records(r.weakEdges)
      .map((e) => ({ from: str(e.from), to: str(e.to), reason: str(e.reason) }))
      .filter((e) => e.from && e.to),
  };
}

const FIXED: GroupKind[] = ["context", "generated"];
const MOVE_FROM: GroupKind[] = ["context", "story", "misc"];
const MOVE_TO: GroupKind[] = ["story", "misc"];
const NAMED: GroupKind[] = ["story", "misc"];

/** Where a moved item goes: docs and config first, tests last, code before tests. */
function insert(items: ReviewItem[], it: ReviewItem): void {
  if (it.role === "docs" || it.role === "config") {
    items.unshift(it);
    return;
  }
  const isTest = (i: ReviewItem) =>
    i.role === "test" || i.role === "test-support";
  const firstTest = items.findIndex(isTest);
  if (isTest(it) || firstTest < 0) {
    items.push(it);
  } else {
    items.splice(firstTest, 0, it);
  }
}

export interface AiResult {
  groups: ReviewGroup[];
  /** Links the model called weak, among the edges the analysis found. */
  weakEdges: AiWeakEdge[];
  /** What was dropped from the answer, for --debug and the corpus. */
  ignored: string[];
  /** Files whose diff the model read with read_diff (summary input). */
  reads: string[];
}

/**
 * Applies an answer to the static order. Context stays first and generated
 * last; unknown groups and files, and moves the rules don't allow, are
 * ignored; groups left empty disappear.
 */
export function applyAnswer(
  groups: ReviewGroup[],
  edges: Edge[],
  answer: AiAnswer,
): AiResult {
  const ignored: string[] = [];
  const out = groups.map((g) => ({
    ...g,
    items: g.items.map((i) => ({ ...i, notes: [...i.notes] })),
  }));
  const valid = (id: number) => id >= 0 && id < out.length;

  for (const g of answer.groups) {
    const target = valid(g.id) ? out[g.id] : undefined;
    if (!target || FIXED.includes(target.kind)) {
      ignored.push(`name for group ${g.id}`);
      continue;
    }
    if (g.title && NAMED.includes(target.kind)) {
      target.title = g.title;
    }
    if (g.purpose) {
      target.purpose = g.purpose;
    }
  }

  const moved = new Set<string>();
  for (const m of answer.moves) {
    const from = out.find((g) => g.items.some((i) => i.path === m.path));
    const to = valid(m.to) ? out[m.to] : undefined;
    if (
      !from ||
      !to ||
      from === to ||
      moved.has(m.path) ||
      !MOVE_FROM.includes(from.kind) ||
      !MOVE_TO.includes(to.kind)
    ) {
      ignored.push(`move of ${m.path} to group ${m.to}`);
      continue;
    }
    const at = from.items.findIndex((i) => i.path === m.path);
    const [it] = from.items.splice(at, 1);
    if (it) {
      it.notes.push(m.reason ? `placed here: ${m.reason}` : "placed here");
      insert(to.items, it);
      moved.add(m.path);
    }
  }

  // Reading order of the movable groups; the ones the answer leaves out keep
  // their static order after the ones it names.
  const movable = out.flatMap((g, i) => (FIXED.includes(g.kind) ? [] : [i]));
  const named = [...new Set(answer.order)].filter((i) => movable.includes(i));
  for (const i of answer.order) {
    if (!movable.includes(i)) {
      ignored.push(`group ${i} in the order`);
    }
  }
  const order = [...named, ...movable.filter((i) => !named.includes(i))];
  const ordered = [
    ...out.filter((g) => g.kind === "context"),
    ...order.flatMap((i) => out[i] ?? []),
    ...out.filter((g) => g.kind === "generated"),
  ].filter((g) => g.items.length > 0);

  // Matched in either direction: models mix up which file is "from".
  const known = new Map(edges.map((e) => [`${e.from}\0${e.to}`, e]));
  const weakEdges = answer.weakEdges.flatMap((w) => {
    const e =
      known.get(`${w.from}\0${w.to}`) ?? known.get(`${w.to}\0${w.from}`);
    if (!e) {
      ignored.push(`weak link ${w.from} → ${w.to}`);
      return [];
    }
    return [{ from: e.from, to: e.to, reason: w.reason }];
  });
  return { groups: ordered, weakEdges, ignored, reads: [] };
}
