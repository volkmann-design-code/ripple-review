import type {
  ChangeRef,
  FileDiff,
  ReviewPayload,
  Tick,
} from "@ripple-review/api-contract";
import type { ChangeSet, ReviewGroup } from "@ripple-review/core/model";
import { sha256Hex } from "@ripple-review/core/sha256";

export const refKey = (ref: ChangeRef) =>
  `${ref.kind}:${ref.owner}/${ref.repo}#${ref.number}`;

/** The change a store key (`refKey`) is of. */
export function refOfKey(key: string): ChangeRef | undefined {
  const m = /^github:([\w.-]+)\/([\w.-]+)#(\d+)$/.exec(key);
  return m?.[1] && m[2] && m[3]
    ? { kind: "github", owner: m[1], repo: m[2], number: Number(m[3]) }
    : undefined;
}

/** Identifies a diff: the same diff gives the same review. */
export function versionOf(cs: ChangeSet): string {
  return sha256Hex(cs.patch ?? JSON.stringify(cs.files)).slice(0, 16);
}

export function filesOf(cs: ChangeSet): Record<string, FileDiff> {
  const out: Record<string, FileDiff> = {};
  for (const f of cs.files) {
    out[f.path] = {
      status: f.status,
      ...(f.oldPath && f.oldPath !== f.path ? { oldPath: f.oldPath } : {}),
      binary: f.binary,
      hunks: f.hunks,
      patchHash: sha256Hex(
        JSON.stringify([f.oldPath, f.status, f.hunks.map((h) => h.lines)]),
      ).slice(0, 16),
      ...(cs.fileLink ? { link: cs.fileLink(f.path) } : {}),
    };
  }
  return out;
}

/** Ticks whose file is still in the change with the same diff. */
export function currentTicks(
  ticks: Tick[],
  files: Record<string, FileDiff>,
): Tick[] {
  return ticks.filter((t) => files[t.path]?.patchHash === t.patchHash);
}

export function payloadOf(
  ref: ChangeRef,
  cs: ChangeSet,
  groups: ReviewGroup[],
): Omit<ReviewPayload, "ticks"> {
  return {
    ref,
    ...(cs.title ? { title: cs.title } : {}),
    ...(cs.url ? { url: cs.url } : {}),
    version: versionOf(cs),
    groups,
    files: filesOf(cs),
  };
}
