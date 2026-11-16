import type { AdapterContext, Snapshot } from "./model.ts";

/**
 * A snapshot held in memory: the file list, plus the content of the files that
 * have one. A listed file without content reads as `undefined` (recorded
 * fixtures keep only the files the analysis read).
 */
export class MemorySnapshot implements Snapshot {
  private readonly paths: readonly string[];
  private readonly pathSet: ReadonlySet<string>;

  constructor(
    private readonly contents: Record<string, string>,
    paths: readonly string[] = Object.keys(contents),
  ) {
    this.paths = [...paths];
    this.pathSet = new Set(paths);
  }

  list(): Promise<readonly string[]> {
    return Promise.resolve(this.paths);
  }

  read(path: string): Promise<string | undefined> {
    return Promise.resolve(
      Object.hasOwn(this.contents, path) && this.pathSet.has(path)
        ? this.contents[path]
        : undefined,
    );
  }
}

/** The context adapters are initialised with: the snapshot and its paths. */
export async function adapterContext(head: Snapshot): Promise<AdapterContext> {
  return { head, paths: new Set(await head.list()) };
}
