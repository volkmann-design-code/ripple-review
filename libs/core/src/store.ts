/**
 * Where something is kept by key, as JSON: AI answers, ticks, file contents
 * by blob SHA. Files for the CLI (`libs/engine/src/node/file-store.ts`),
 * IndexedDB in the web app, memory in tests.
 */
export interface Store {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
}

/** An entry of a store, with its size: about the characters of its JSON. */
export interface StoredEntry {
  key: string;
  size: number;
}

/** A store that can say what it keeps and forget single entries (the web app's settings). */
export interface ListedStore extends Store {
  list(): Promise<StoredEntry[]>;
  delete(keys: readonly string[]): Promise<void>;
}

/** A store that lives as long as the process: tests, one-off runs. */
export class MemoryStore implements ListedStore {
  private readonly values = new Map<string, string>();

  get<T>(key: string): Promise<T | undefined> {
    const v = this.values.get(key);
    return Promise.resolve(v === undefined ? undefined : (JSON.parse(v) as T));
  }

  put(key: string, value: unknown): Promise<void> {
    this.values.set(key, JSON.stringify(value));
    return Promise.resolve();
  }

  list(): Promise<StoredEntry[]> {
    return Promise.resolve(
      [...this.values].map(([key, v]) => ({ key, size: v.length })),
    );
  }

  delete(keys: readonly string[]): Promise<void> {
    for (const k of keys) {
      this.values.delete(k);
    }
    return Promise.resolve();
  }
}
