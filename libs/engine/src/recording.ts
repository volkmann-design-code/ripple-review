import { parseUnifiedDiff } from "@ripple-review/core/diff";
import type { ChangeSet } from "@ripple-review/core/model";
import { MemorySnapshot } from "@ripple-review/core/snapshot";
import { githubFileLink } from "@ripple-review/forge-github";

/*
 * A recorded change (a fixture), read from its files' contents (the CLI
 * reads them from disk: `@ripple-review/sources/fixture`). The files of a
 * recording:
 *   meta.json      title and url
 *   diff.patch     the unified diff
 *   tree.txt.gz    every path at head, one per line
 *   files.json.gz  path → content, only for the files the analysis read
 */

export interface RecordingMeta {
  title?: string;
  url?: string;
}

/** A recording's contents, the gzipped files already unpacked. */
export interface Recording {
  meta: RecordingMeta;
  patch: string;
  tree: string;
  files: string;
}

export function changeFromRecording(r: Recording): ChangeSet {
  const tree = r.tree.split("\n").filter(Boolean);
  const files = JSON.parse(r.files) as Record<string, string>;
  const url = r.meta.url;
  return {
    title: r.meta.title,
    url,
    fileLink:
      url && /^https:\/\/github\.com\/.+\/pull\/\d+$/.test(url)
        ? (path) => githubFileLink(url, path)
        : undefined,
    head: new MemorySnapshot(files, tree),
    files: parseUnifiedDiff(r.patch),
    patch: r.patch,
  };
}
