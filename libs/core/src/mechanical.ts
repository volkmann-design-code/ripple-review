import {
  type ConstantValue,
  constantEnv,
  definedName,
  foldConstants,
} from "./constants.ts";
import { changedLines } from "./diff.ts";
import type { FileNode } from "./model.ts";

export interface MechanicalGroup {
  /** The edit the files share, as diff lines ("+…" / "-…"). */
  lines: string[];
  files: string[];
  /** The files are new and have the same content (a config copied per project). */
  newFiles?: boolean;
}

const MAX_CHANGED_LINES = 12;
const MIN_FILES = 3;
const MIN_SHARED_FRACTION = 0.4;
const MAX_NEW_FILE_LINES = 60;

/**
 * Whitespace-insensitive, with path-like string literals blanked so
 * `from "./a"` and `from "../a"` match. Other literals stay: blanking every
 * string would make `"linter": {` and `"scripts": {` the same JSON line.
 */
const norm = (s: string) =>
  s
    .trim()
    .replace(/\s+/g, " ")
    .replace(/(["'`])((?:\\.|(?!\1).)*)\1/g, (lit, q: string, body: string) =>
      /^[.@~]|\//.test(body) ? `${q}…${q}` : lit,
    );
const trivial = (s: string) => s.length < 4 || /^[\s{}()[\];,]*$/.test(s);

/**
 * Drops pairs of a removed and an added line that hold the same value once
 * constants are folded (`86_400_000` → `DAY_MS`). Returns what is left and
 * the constants the added side introduced.
 */
function cancelSameValue(
  added: string[],
  removed: string[],
  env: ReadonlyMap<string, ConstantValue>,
): { added: string[]; removed: string[]; names: Set<string> } {
  const names = new Set<string>();
  if (env.size === 0) {
    return { added, removed, names };
  }
  // Literals stay as they are: blanking paths here would make "/a" and "/b"
  // the same value.
  const fold = (l: string) => {
    const f = foldConstants(l, env);
    const key = f.text
      .replace(/\s+\/\/.*$/, "")
      .trim()
      .replace(/\s+/g, " ");
    return { key, names: f.names };
  };
  const pool = new Map<string, { i: number; names: string[] }[]>();
  removed.forEach((l, i) => {
    const f = fold(l);
    pool.set(f.key, [...(pool.get(f.key) ?? []), { i, names: f.names }]);
  });
  const gone = new Set<number>();
  const keep: string[] = [];
  for (const l of added) {
    const f = fold(l);
    const candidates = pool.get(f.key) ?? [];
    // Only a pair a constant takes part in: a quote or `1_000` → `1000`
    // change stays a plain edit.
    const at = candidates.findIndex(
      (c) =>
        removed[c.i]?.trim() !== l.trim() &&
        (f.names.length > 0 || c.names.length > 0),
    );
    const match = candidates[at];
    if (match === undefined) {
      keep.push(l);
      continue;
    }
    candidates.splice(at, 1);
    gone.add(match.i);
    for (const n of [...f.names, ...match.names]) {
      names.add(n);
    }
  }
  // A local definition dropped in favour of the shared one (now imported).
  removed.forEach((l, i) => {
    const name = definedName(l);
    if (
      name &&
      env.has(name) &&
      keep.some((a) => new RegExp(`\\b${name}\\b`).test(a))
    ) {
      gone.add(i);
      names.add(name);
    }
  });
  return {
    added: keep,
    removed: removed.filter((_, i) => !gone.has(i)),
    names,
  };
}

/**
 * Finds the "same small edit in many files" pattern (renamed import, moved
 * helper, signature tweak): small diffs that share changed lines with at least
 * two other small diffs. Such files are read as one item, not one by one.
 */
export function findMechanical(nodes: FileNode[]): MechanicalGroup[] {
  const sigs = new Map<string, Set<string>>();
  const example = new Map<string, string>();
  const candidates = nodes.filter(
    (n) =>
      !n.file.binary &&
      (n.file.status === "modified" || n.file.status === "renamed") &&
      n.file.additions + n.file.deletions > 0,
  );
  const env = constantEnv(
    candidates.flatMap((n) => {
      const { added, removed } = changedLines(n.file);
      return [...added, ...removed];
    }),
  );
  for (const n of candidates) {
    const f = n.file;
    const lines = changedLines(f);
    const { added, removed, names } = cancelSameValue(
      lines.added,
      lines.removed,
      env,
    );
    if (added.length + removed.length > MAX_CHANGED_LINES) {
      continue;
    }
    const sig = new Set<string>();
    for (const name of names) {
      const key = `=${name}`;
      sig.add(key);
      example.set(key, `${name} for the same value`);
    }
    const take = (prefix: string, l: string) => {
      const key = `${prefix}${norm(l)}`;
      if (trivial(norm(l))) {
        return;
      }
      sig.add(key);
      if (!example.has(key)) {
        example.set(key, `${prefix}${l.trim().replace(/\s+/g, " ")}`);
      }
    };
    for (const l of added) {
      take("+", l);
    }
    for (const l of removed) {
      take("-", l);
    }
    if (sig.size > 0) {
      sigs.set(f.path, sig);
    }
  }

  const filesByLine = new Map<string, string[]>();
  for (const [path, sig] of sigs) {
    for (const l of sig) {
      filesByLine.set(l, [...(filesByLine.get(l) ?? []), path]);
    }
  }
  const shared = new Set(
    [...filesByLine].filter(([, fs]) => fs.length >= MIN_FILES).map(([l]) => l),
  );

  // Union files that share a common line.
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    while (parent.get(x) !== x) {
      x = parent.get(x)!;
    }
    return x;
  };
  for (const p of sigs.keys()) {
    parent.set(p, p);
  }
  for (const l of shared) {
    const [first, ...rest] = filesByLine.get(l)!;
    for (const r of rest) {
      parent.set(find(r), find(first!));
    }
  }

  const comps = new Map<string, string[]>();
  for (const p of sigs.keys()) {
    const sig = sigs.get(p)!;
    // Lines that mention a constant of a same-value edit are part of that edit.
    const mentions = [...sig]
      .filter((l) => l[0] === "=")
      .map((l) => new RegExp(`\\b${l.slice(1)}\\b`));
    const sharedCount = [...sig].filter(
      (l) => shared.has(l) || (l[0] !== "=" && mentions.some((m) => m.test(l))),
    ).length;
    if (sharedCount === 0 || sharedCount / sig.size < MIN_SHARED_FRACTION) {
      continue;
    }
    const root = find(p);
    comps.set(root, [...(comps.get(root) ?? []), p]);
  }

  const groups: MechanicalGroup[] = [];
  for (const files of comps.values()) {
    if (files.length < MIN_FILES) {
      continue;
    }
    const counts = new Map<string, number>();
    for (const f of files) {
      for (const l of sigs.get(f)!) {
        if (shared.has(l)) {
          counts.set(l, (counts.get(l) ?? 0) + 1);
        }
      }
    }
    const lines = [...counts]
      .filter(([, c]) => c * 2 >= files.length)
      .sort((a, b) => b[1] - a[1] || (a[0][0] === "-" ? -1 : 1))
      .slice(0, 3)
      .map(([l]) => example.get(l) ?? l);
    groups.push({ lines, files: files.sort() });
  }
  return [...groups, ...identicalNewFiles(nodes)];
}

/** New files with the same content (paths aside), read once for all. */
function identicalNewFiles(nodes: FileNode[]): MechanicalGroup[] {
  const byContent = new Map<string, string[]>();
  const first = new Map<string, string>();
  for (const n of nodes) {
    const f = n.file;
    if (f.status !== "added" || f.binary || f.additions > MAX_NEW_FILE_LINES) {
      continue;
    }
    const { added } = changedLines(f);
    const key = added.map(norm).join("\n").trim();
    if (key === "") {
      continue;
    }
    byContent.set(key, [...(byContent.get(key) ?? []), f.path]);
    if (!first.has(key)) {
      first.set(
        key,
        added.find((l) => !trivial(norm(l)))?.trim() ?? added[0]?.trim() ?? "",
      );
    }
  }
  return [...byContent]
    .filter(([, files]) => files.length >= MIN_FILES)
    .map(([key, files]) => ({
      lines: [first.get(key) ?? ""],
      files: files.sort(),
      newFiles: true,
    }));
}
