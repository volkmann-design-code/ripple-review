import type {
  Forgettable,
  Progress,
  StoredChange,
  StoredData,
} from "@ripple-review/api-contract";
import type { ListedStore, StoredEntry } from "@ripple-review/core/store";
import type { ChangeRecord } from "./changes";
import type { KeptDrafts } from "./drafts";
import { refKey, refOfKey } from "./payload";

/*
 * What the engine keeps in this browser, grouped by change for the settings
 * page, and deleting one group at a time.
 */

export interface EngineStores {
  /** AI answers by request hash. */
  ai: ListedStore;
  /** Ticks and the AI choice, by change. */
  progress: ListedStore;
  /** File contents by blob SHA. */
  blobs: ListedStore;
  /** Saved reviews, by engine version, change and diff. */
  reviews: ListedStore;
  /** Unsubmitted summaries and drafts the forge hasn't taken, by change. */
  drafts: ListedStore;
  /** The changes opened here (`Changes`), by change. */
  changes: ListedStore;
}

/** The change a saved review is of: `<version>:<refKey>@<diff>[+ai]`. */
const savedReviewOf = (key: string) => /^\d+:(.+)@[^@]+$/.exec(key)?.[1];

const total = (entries: StoredEntry[]) =>
  entries.reduce((n, e) => n + e.size, 0);

export async function storedData(stores: EngineStores): Promise<StoredData> {
  const [ai, progress, blobs, reviews, drafts, changes] = await Promise.all([
    stores.ai.list(),
    stores.progress.list(),
    stores.blobs.list(),
    stores.reviews.list(),
    stores.drafts.list(),
    stores.changes.list(),
  ]);
  const rows = new Map<string, StoredChange>();
  const row = (key: string): StoredChange | undefined => {
    let r = rows.get(key);
    if (!r) {
      const ref = refOfKey(key);
      if (!ref) {
        return undefined;
      }
      r = {
        ref,
        reviews: 0,
        ticks: 0,
        waitingDrafts: 0,
        summary: false,
        aiAnswers: 0,
        size: 0,
      };
      rows.set(key, r);
    }
    return r;
  };

  const records = await getAll<ChangeRecord>(stores.changes, changes);
  const aiOwner = new Map<string, string>();
  for (const [e, rec] of records) {
    const r = row(e.key);
    if (r && rec) {
      r.size += e.size;
      if (rec.title) {
        r.title = rec.title;
      }
      r.openedAt = rec.openedAt;
      for (const k of rec.aiAnswers ?? []) {
        aiOwner.set(k, e.key);
      }
    }
  }
  for (const e of reviews) {
    const key = savedReviewOf(e.key);
    const r = key ? row(key) : undefined;
    if (r) {
      r.reviews++;
      r.size += e.size;
    }
  }
  for (const [e, p] of await getAll<Progress>(stores.progress, progress)) {
    const r = row(e.key);
    if (r) {
      r.ticks = p?.ticks.length ?? 0;
      r.size += e.size;
    }
  }
  for (const [e, d] of await getAll<KeptDrafts>(stores.drafts, drafts)) {
    const r = row(e.key);
    if (r) {
      r.waitingDrafts = d?.ops?.length ?? 0;
      r.summary = Boolean(d?.summary?.trim());
      r.size += e.size;
    }
  }
  const otherAi: StoredEntry[] = [];
  for (const e of ai) {
    const owner = aiOwner.get(e.key);
    const r = owner ? rows.get(owner) : undefined;
    if (r) {
      r.aiAnswers++;
      r.size += e.size;
    } else {
      otherAi.push(e);
    }
  }
  return {
    changes: [...rows.values()].sort(
      (a, b) =>
        (b.openedAt ?? "").localeCompare(a.openedAt ?? "") ||
        refKey(a.ref).localeCompare(refKey(b.ref)),
    ),
    otherAiAnswers: { count: otherAi.length, size: total(otherAi) },
    files: { count: blobs.length, size: total(blobs) },
  };
}

/** Deletes one group of what `storedData` lists. */
export async function forget(
  stores: EngineStores,
  what: Forgettable,
): Promise<void> {
  if (what.kind === "files") {
    await stores.blobs.delete((await stores.blobs.list()).map((e) => e.key));
    return;
  }
  const records = await getAll<ChangeRecord>(
    stores.changes,
    await stores.changes.list(),
  );
  const owned = (except?: string) =>
    new Set(
      records.flatMap(([e, r]) =>
        e.key === except ? [] : (r?.aiAnswers ?? []),
      ),
    );
  if (what.kind === "other-ai-answers") {
    const keep = owned();
    await stores.ai.delete(
      (await stores.ai.list()).map((e) => e.key).filter((k) => !keep.has(k)),
    );
    return;
  }
  const key = refKey(what.ref);
  // An answer another change also used stays for that one.
  const others = owned(key);
  const answers = (
    records.find(([e]) => e.key === key)?.[1]?.aiAnswers ?? []
  ).filter((k) => !others.has(k));
  const saved = (await stores.reviews.list())
    .map((e) => e.key)
    .filter((k) => savedReviewOf(k) === key);
  await Promise.all([
    stores.reviews.delete(saved),
    stores.ai.delete(answers),
    stores.progress.delete([key]),
    stores.drafts.delete([key]),
    stores.changes.delete([key]),
  ]);
}

async function getAll<T>(
  store: ListedStore,
  entries: StoredEntry[],
): Promise<[StoredEntry, T | undefined][]> {
  const values = await Promise.all(entries.map((e) => store.get<T>(e.key)));
  return entries.map((e, i) => [e, values[i]]);
}
