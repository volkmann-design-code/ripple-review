import {
  type ListedStore,
  MemoryStore,
  type StoredEntry,
} from "@ripple-review/core/store";
import { DB_NAME } from "./api";

/*
 * The web app's storage: one IndexedDB database in the user's browser (D22),
 * nothing on a server. Listed, and cleared, on the settings page.
 */

const STORES = [
  "ai",
  "progress",
  "blobs",
  "reviews",
  "drafts",
  "changes",
] as const;
export type StoreName = (typeof STORES)[number];

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 4);
    req.onupgradeneeded = () => {
      for (const name of STORES) {
        if (!req.result.objectStoreNames.contains(name)) {
          req.result.createObjectStore(name);
        }
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // Let "Clear stored data" delete the database while the app runs.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB is blocked"));
  });
}

interface Pending {
  gets: Map<string, ((v: unknown) => void)[]>;
  puts: Map<string, unknown>;
  putDone: (() => void)[];
  failed: ((e: unknown) => void)[];
}

/**
 * One object store. Reads and writes asked for in the same turn go into one
 * transaction each: a review reads and writes a thousand files' contents.
 */
class IdbStore implements ListedStore {
  private pending?: Pending;

  constructor(
    private readonly db: () => Promise<IDBDatabase>,
    private readonly name: StoreName,
  ) {}

  get<T>(key: string): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      const p = this.queue();
      const waiting = p.gets.get(key) ?? [];
      waiting.push(resolve as (v: unknown) => void);
      p.gets.set(key, waiting);
      p.failed.push(reject);
    });
  }

  put(key: string, value: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      const p = this.queue();
      p.puts.set(key, value);
      p.putDone.push(resolve);
      p.failed.push(reject);
    });
  }

  /** Every entry with its size; reads the values, so it is slow on big stores. */
  async list(): Promise<StoredEntry[]> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const out: StoredEntry[] = [];
      const req = db
        .transaction(this.name, "readonly")
        .objectStore(this.name)
        .openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) {
          resolve(out);
          return;
        }
        out.push({ key: String(cursor.key), size: sizeOf(cursor.value) });
        cursor.continue();
      };
      req.onerror = () => reject(req.error);
    });
  }

  async delete(keys: readonly string[]): Promise<void> {
    if (!keys.length) {
      return;
    }
    const db = await this.db();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.name, "readwrite");
      const store = tx.objectStore(this.name);
      for (const k of keys) {
        store.delete(k);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private queue(): Pending {
    if (!this.pending) {
      const p: Pending = {
        gets: new Map(),
        puts: new Map(),
        putDone: [],
        failed: [],
      };
      this.pending = p;
      setTimeout(() => {
        this.pending = undefined;
        this.flush(p).catch((e) => {
          for (const f of p.failed) {
            f(e);
          }
        });
      }, 0);
    }
    return this.pending;
  }

  private async flush(p: Pending): Promise<void> {
    const db = await this.db();
    // Writes first: a transaction created earlier on the same store runs
    // earlier, so a read asked for after a write sees it.
    if (p.puts.size) {
      const tx = db.transaction(this.name, "readwrite");
      const store = tx.objectStore(this.name);
      for (const [k, v] of p.puts) {
        store.put(v, k);
      }
      tx.oncomplete = () => {
        for (const done of p.putDone) {
          done();
        }
      };
      tx.onerror = () => {
        for (const f of p.failed) {
          f(tx.error);
        }
      };
    }
    if (p.gets.size) {
      const tx = db.transaction(this.name, "readonly");
      const store = tx.objectStore(this.name);
      for (const [k, waiting] of p.gets) {
        const req = store.get(k);
        req.onsuccess = () => {
          for (const w of waiting) {
            w(req.result);
          }
        };
      }
      tx.onerror = () => {
        for (const f of p.failed) {
          f(tx.error);
        }
      };
    }
  }
}

/**
 * The app's stores in IndexedDB; in memory (for this visit only) when the
 * browser doesn't allow IndexedDB.
 */
export function browserStores(): Record<StoreName, ListedStore> {
  let db: Promise<IDBDatabase> | undefined;
  const connect = () => {
    db ??= openDb();
    return db;
  };
  const fallback = {} as Record<StoreName, MemoryStore>;
  for (const name of STORES) {
    fallback[name] = new MemoryStore();
  }
  let usable: Promise<boolean> | undefined;
  const available = () => {
    usable ??= connect().then(
      () => true,
      () => false,
    );
    return usable;
  };
  const store = (name: StoreName): ListedStore => {
    const idb = new IdbStore(connect, name);
    const use = async (): Promise<ListedStore> =>
      (await available()) ? idb : fallback[name];
    return {
      async get<T>(key: string) {
        return (await use()).get<T>(key);
      },
      async put(key, value) {
        return (await use()).put(key, value);
      },
      async list() {
        return (await use()).list();
      },
      async delete(keys) {
        return (await use()).delete(keys);
      },
    };
  };
  const out = {} as Record<StoreName, ListedStore>;
  for (const name of STORES) {
    out[name] = store(name);
  }
  return out;
}

/** About the characters a value takes: file contents are strings. */
function sizeOf(value: unknown): number {
  return typeof value === "string"
    ? value.length
    : (JSON.stringify(value)?.length ?? 0);
}
