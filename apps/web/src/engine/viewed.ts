import type {
  FileDiff,
  PendingMark,
  Tick,
  ViewedSync,
} from "@ripple-review/api-contract";
import type { ViewedChange, ViewedState } from "@ripple-review/core/forge";
import { failureOf } from "./errors";

/** One change's "Viewed" marks on its forge. */
export interface ViewedPort {
  /** The forge's name for the user, e.g. "GitHub". */
  forge: string;
  get(): Promise<Map<string, ViewedState>>;
  set(changes: ViewedChange[]): Promise<void>;
}

/** The marks a new tick set changes, against the ticks shown before. */
export function marksBetween(before: Tick[], after: Tick[]): PendingMark[] {
  const was = new Map(before.map((t) => [t.path, t]));
  const now = new Map(after.map((t) => [t.path, t]));
  const marks: PendingMark[] = [];
  for (const t of after) {
    if (was.get(t.path)?.patchHash !== t.patchHash) {
      marks.push({ ...t, viewed: true });
    }
  }
  for (const t of before) {
    if (!now.has(t.path)) {
      marks.push({ ...t, viewed: false });
    }
  }
  return marks;
}

/** Marks not yet sent with newer ones on top (the last one per file wins). */
export function withMarks(
  pending: PendingMark[],
  marks: PendingMark[],
): PendingMark[] {
  const byPath = new Map(pending.map((m) => [m.path, m]));
  for (const m of marks) {
    byPath.set(m.path, m);
  }
  return [...byPath.values()];
}

/**
 * Marks still worth sending: the file is still in the change and, for a
 * tick, its diff is the one the reviewer saw.
 */
export function livePending(
  pending: PendingMark[],
  files: Record<string, FileDiff>,
): PendingMark[] {
  return pending.filter(
    (m) =>
      files[m.path] !== undefined &&
      (!m.viewed || files[m.path]?.patchHash === m.patchHash),
  );
}

/** The ticks to show: the forge's marks, with marks not sent yet on top. */
export function ticksOf(
  remote: Map<string, ViewedState>,
  pending: PendingMark[],
  files: Record<string, FileDiff>,
): Tick[] {
  const viewed = new Set(
    [...remote].filter(([, s]) => s === "viewed").map(([p]) => p),
  );
  for (const m of pending) {
    if (m.viewed) {
      viewed.add(m.path);
    } else {
      viewed.delete(m.path);
    }
  }
  return Object.entries(files)
    .filter(([path]) => viewed.has(path))
    .map(([path, f]) => ({ path, patchHash: f.patchHash }));
}

export function notSynced(
  port: ViewedPort,
  what: string,
  err: unknown,
): ViewedSync {
  const f = failureOf(err);
  return {
    forge: port.forge,
    synced: false,
    status: f.status,
    error: `${what}: ${f.error}`,
    ...(f.hint ? { hint: f.hint } : {}),
  };
}
