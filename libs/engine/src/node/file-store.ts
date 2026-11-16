import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Store } from "../store.ts";

/*
 * The engine's Node/Bun-only part: the rest of libs/engine runs in a browser
 * too, and only the CLI imports from `node/`.
 */

/** One JSON file per key in a directory. Keys must be file-name safe. */
export class FileStore implements Store {
  constructor(readonly dir: string) {}

  path(key: string): string {
    return join(this.dir, `${key}.json`);
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      return JSON.parse(await readFile(this.path(key), "utf8")) as T;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        return undefined;
      }
      throw e;
    }
  }

  async put(key: string, value: unknown): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.path(key), `${JSON.stringify(value, null, 2)}\n`);
  }
}

/** `$XDG_CACHE_HOME/ripple-review/ai`: where the CLI keeps AI answers. */
export function aiCacheDir(): string {
  const base = process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache");
  return join(base, "ripple-review", "ai");
}
