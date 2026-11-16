import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import type { ChangeSet, Snapshot } from "@ripple-review/core/model";
import {
  changeFromRecording,
  type RecordingMeta,
} from "@ripple-review/engine/recording";

/*
 * A recorded fixture is a change stored on disk so the analysis runs offline
 * (its files: `@ripple-review/engine/recording`). The two large files are
 * gzipped: a PR's analysis reads megabytes of source (barrels, generated
 * schemas).
 */

/** Passes everything through to `inner` and remembers every file read. */
export class RecordingSnapshot implements Snapshot {
  readonly reads = new Map<string, string>();

  constructor(private readonly inner: Snapshot) {}

  list(): Promise<readonly string[]> {
    return this.inner.list();
  }

  async read(path: string): Promise<string | undefined> {
    const content = await this.inner.read(path);
    if (content !== undefined) {
      this.reads.set(path, content);
    }
    return content;
  }
}

/**
 * Wraps a change so that what the analysis reads is recorded; call `save`
 * once the analysis has run.
 */
export function recordFixture(cs: ChangeSet): {
  cs: ChangeSet;
  save: (dir: string) => Promise<void>;
} {
  const patch = cs.patch;
  if (patch === undefined) {
    throw new Error("this source has no diff text to record");
  }
  const head = new RecordingSnapshot(cs.head);
  return {
    cs: { ...cs, head },
    async save(dir) {
      const tree = await head.list();
      mkdirSync(dir, { recursive: true });
      const meta: RecordingMeta = { title: cs.title, url: cs.url };
      writeFileSync(
        join(dir, "meta.json"),
        `${JSON.stringify(meta, null, 2)}\n`,
      );
      writeFileSync(join(dir, "diff.patch"), patch);
      writeFileSync(
        join(dir, "tree.txt.gz"),
        gzipSync(`${tree.join("\n")}\n`, { level: 9 }),
      );
      const files = Object.fromEntries(
        [...head.reads].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      );
      writeFileSync(
        join(dir, "files.json.gz"),
        gzipSync(`${JSON.stringify(files, null, 2)}\n`, { level: 9 }),
      );
    },
  };
}

/** Loads a fixture written by `recordFixture`. */
export function loadFixture(dir: string): ChangeSet {
  const text = (name: string) => readFileSync(join(dir, name), "utf8");
  const gunzip = (name: string) =>
    gunzipSync(readFileSync(join(dir, name))).toString("utf8");
  return changeFromRecording({
    meta: JSON.parse(text("meta.json")) as RecordingMeta,
    patch: text("diff.patch"),
    tree: gunzip("tree.txt.gz"),
    files: gunzip("files.json.gz"),
  });
}
