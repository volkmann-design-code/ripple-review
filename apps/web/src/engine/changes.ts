import type {
  ChangeRef,
  RecentChange,
  ReviewPayload,
} from "@ripple-review/api-contract";
import type { ListedStore } from "@ripple-review/core/store";
import { refKey } from "./payload";
import { Serial } from "./serial";

/*
 * What the app remembers of each change opened in this browser: for
 * "Recently viewed" on the start page, and to tie the AI's answers to the
 * change they are about, so the settings page can delete them together.
 */

/** A change's record, by `refKey`. */
export interface ChangeRecord extends RecentChange {
  /** Keys of the AI answers about it (in the `ai` store). */
  aiAnswers?: string[];
}

export class Changes {
  private readonly queue = new Serial();

  constructor(private readonly store: ListedStore) {}

  /** The change was opened (its review shown). */
  opened(payload: ReviewPayload): Promise<void> {
    return this.update(payload.ref, (r) => ({
      ...r,
      ref: payload.ref,
      ...(payload.title ? { title: payload.title } : {}),
      ...(payload.url ? { url: payload.url } : {}),
      openedAt: new Date().toISOString(),
      files: Object.keys(payload.files).length,
      ticked: payload.ticks.length,
    }));
  }

  ticked(ref: ChangeRef, ticked: number): Promise<void> {
    return this.update(ref, (r) => (r ? { ...r, ticked } : undefined));
  }

  /** An AI answer about the change was saved or used (before `opened`, on a first visit). */
  aiAnswer(ref: ChangeRef, key: string): Promise<void> {
    return this.update(ref, (r) => {
      if (r?.aiAnswers?.includes(key)) {
        return r;
      }
      const base = r ?? {
        ref,
        openedAt: new Date().toISOString(),
        files: 0,
        ticked: 0,
      };
      return { ...base, aiAnswers: [...(base.aiAnswers ?? []), key] };
    });
  }

  /** The changes opened here, most recently opened first. */
  async recent(limit: number): Promise<RecentChange[]> {
    return (await this.all())
      .sort((a, b) => b.openedAt.localeCompare(a.openedAt))
      .slice(0, limit)
      .map(({ aiAnswers: _, ...r }) => r);
  }

  async all(): Promise<ChangeRecord[]> {
    const keys = (await this.store.list()).map((e) => e.key);
    const records = await Promise.all(
      keys.map((k) => this.store.get<ChangeRecord>(k)),
    );
    return records.filter((r): r is ChangeRecord => r !== undefined);
  }

  /** Remembering is a convenience: a failure doesn't fail the review. */
  private update(
    ref: ChangeRef,
    change: (r: ChangeRecord | undefined) => ChangeRecord | undefined,
  ): Promise<void> {
    const key = refKey(ref);
    return this.queue
      .run(key, async () => {
        const before = await this.store.get<ChangeRecord>(key);
        const after = change(before);
        if (after && after !== before) {
          await this.store.put(key, after);
        }
      })
      .catch(() => {});
  }
}
