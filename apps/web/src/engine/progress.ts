import type { Progress } from "@ripple-review/api-contract";
import type { Store } from "@ripple-review/core/store";

/** The reviewer's ticks and AI choice per change, kept in a `Store` (IndexedDB). */
export class ProgressStore {
  constructor(private readonly store: Store) {}

  async get(key: string): Promise<Progress> {
    return (await this.store.get<Progress>(key)) ?? { ticks: [] };
  }

  async put(key: string, progress: Progress): Promise<Progress> {
    const p = { ...progress, updatedAt: new Date().toISOString() };
    await this.store.put(key, p);
    return p;
  }
}
