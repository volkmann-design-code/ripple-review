import { classify, generatedMatcher } from "./classify.ts";
import { changedLines, contentBefore } from "./diff.ts";
import type { FrameworkFacts, FrameworkRule } from "./framework.ts";
import { generatorMatcher } from "./generators.ts";
import type {
  ChangeSet,
  Edge,
  EdgeKind,
  FileNode,
  LanguageAdapter,
  ModuleFacts,
} from "./model.ts";
import { adapterContext } from "./snapshot.ts";

export interface Analysis {
  nodes: Map<string, FileNode>;
  edges: Edge[];
}

/** What the analysis is doing, for progress shown to the user. */
export type AnalysisStep =
  /** The file list and the config files the adapters need (tsconfig, …). */
  | { step: "setup" }
  /** The changed files, read and parsed. */
  | { step: "read"; done: number; total: number }
  /** Unchanged files read to follow imports through them (barrels). */
  | { step: "follow"; files: number }
  /** Links between the changed files, by imports and by names. */
  | { step: "link" };

const IDENT = /[A-Za-z_][A-Za-z0-9_]*/g;
/** kebab-case names (custom elements, Angular selectors): `app-line-items`. */
const KEBAB = /[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)+/g;
/** The body of a string literal without spaces: a key such as `referrals:write`. */
const STRING_KEY = /(["'`])([^"'`\s\\]{6,})\1/g;

/** Words of a name: `set_line_items` and `setLineItems` are both set/line/items. */
const words = (name: string) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .split(/[_\W]+/)
    .filter(Boolean);
/**
 * One spelling for snake_case, camelCase and PascalCase, for names of three or
 * more words: generators rename across languages (an SQL function
 * `set_line_items_tax_rate` becomes the GraphQL mutation `setLineItemsTaxRate`).
 * Shorter names (`user_id`/`userId`) are too common to link that way.
 */
function spelling(name: string): string | undefined {
  const w = words(name);
  return w.length >= 3 && /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)
    ? w.join("_").toLowerCase()
    : undefined;
}

/**
 * A name specific enough that a mention of it in another file is a real link.
 * A framework's names (a task's `send-mail`) are kebab-case more often than
 * not, and known to be names: a hyphen counts like an underscore for them.
 */
function distinctive(name: string, byFramework = false): boolean {
  if (name.length < 6) {
    return false;
  }
  return (
    name.includes("_") ||
    /[a-z][A-Z]/.test(name) ||
    name.length >= 12 ||
    (byFramework && name.includes("-"))
  );
}

/**
 * Builds the dependency graph between the changed files:
 *  - import edges, with symbols followed through barrels (re-exports) to the file
 *    that defines them, across unchanged files;
 *  - contains edges (includes);
 *  - name edges: a file's diff mentions (as an identifier, a kebab-case name or a string literal)
 *    a distinctive name another changed file defines - the language-agnostic glue (SQL function ↔ TS caller, etc.);
 *  - framework edges: conventions of the frameworks the repository uses
 *    (`frameworks`), as parts, files read first and names.
 */
export async function analyze(
  cs: ChangeSet,
  adapters: LanguageAdapter[],
  frameworks: FrameworkRule[] = [],
  onStep: (s: AnalysisStep) => void = () => {},
): Promise<Analysis> {
  // Reads are asked for together wherever the order doesn't matter, so a
  // snapshot on an API (or git) can serve them in one batch (D22).
  onStep({ step: "setup" });
  const ctx = await adapterContext(cs.head);
  const matchers = Promise.all([
    generatedMatcher(cs.head),
    generatorMatcher(cs.head),
  ]);
  const [, detected] = await Promise.all([
    Promise.all(adapters.map((a) => a.init?.(ctx))),
    Promise.all(frameworks.map((f) => f.detect(ctx))),
  ]);
  const rules = frameworks.filter((_, i) => detected[i]);
  const [byAttributes, byGenerator] = await matchers;
  const isGenerated = (p: string) => byAttributes(p) || byGenerator(p);
  const adapterFor = (path: string) => adapters.find((a) => a.supports(path));

  const nodes = new Map<string, FileNode>();
  const frameworkFacts = new Map<string, RuleFacts[]>();
  const factsCache = new Map<string, Promise<ModuleFacts | undefined>>();

  const total = cs.files.length;
  let done = 0;
  onStep({ step: "read", done, total });
  const contents = await Promise.all(
    cs.files.map(async (file) => {
      const content = file.binary
        ? undefined
        : file.status === "removed"
          ? contentBefore(file)
          : await cs.head.read(file.path);
      onStep({ step: "read", done: ++done, total });
      return content;
    }),
  );
  for (const [i, file] of cs.files.entries()) {
    const adapter = file.binary ? undefined : adapterFor(file.path);
    const content = contents[i];
    let facts: ModuleFacts | undefined;
    if (adapter && content !== undefined) {
      try {
        facts = adapter.parse(file.path, content);
      } catch {
        facts = undefined;
      }
    }
    factsCache.set(file.path, Promise.resolve(facts));
    const byRule: RuleFacts[] = [];
    for (const rule of rules) {
      let f: FrameworkFacts | undefined;
      try {
        f = rule.file?.({ path: file.path, content, facts });
      } catch {
        f = undefined;
      }
      if (f) {
        byRule.push({ rule: rule.name, facts: f });
      }
    }
    if (byRule.length) {
      frameworkFacts.set(file.path, byRule);
    }
    const ruleHint = rules
      .map((r) => r.roleHint?.(file.path))
      .find((h) => h !== undefined);
    nodes.set(file.path, {
      file,
      role: classify(file, content, adapter, facts, isGenerated, ruleHint),
      adapter: adapter?.id,
      facts,
    });
  }

  let followed = 0;
  const parsed = async (path: string): Promise<ModuleFacts | undefined> => {
    const adapter = adapterFor(path);
    const content = adapter ? await cs.head.read(path) : undefined;
    onStep({ step: "follow", files: ++followed });
    try {
      return adapter && content !== undefined
        ? adapter.parse(path, content)
        : undefined;
    } catch {
      return undefined;
    }
  };
  const factsOf = (path: string): Promise<ModuleFacts | undefined> => {
    let facts = factsCache.get(path);
    if (!facts) {
      facts = parsed(path);
      factsCache.set(path, facts);
    }
    return facts;
  };
  const targetsOf = (from: string, refs: readonly { specifier: string }[]) => {
    const adapter = adapterFor(from);
    return refs
      .map((x) => adapter?.resolve(x.specifier, from))
      .filter((t): t is string => t !== undefined);
  };
  /**
   * Reads a file and, through its re-exports, the barrel tree below it,
   * breadth-first and all branches at once: the searches in `definingFile`
   * then find everything read, and a snapshot on an API needs one round
   * trip per level instead of one per search step.
   */
  const warmed = new Set<string>();
  const warm = async (path: string): Promise<void> => {
    if (warmed.has(path)) {
      return;
    }
    warmed.add(path);
    const facts = await factsOf(path);
    await Promise.all(targetsOf(path, facts?.reexports ?? []).map(warm));
  };

  /** The file that actually defines `name` when imported from `file` (follows re-exports). */
  const definingFile = async (
    file: string,
    name: string,
    seen = new Set<string>(),
    depth = 0,
  ): Promise<string | undefined> => {
    if (seen.has(file) || depth > 12) {
      return undefined;
    }
    seen.add(file);
    const facts = await factsOf(file);
    if (!facts) {
      return undefined;
    }
    if (facts.exports.includes(name)) {
      return file;
    }
    const adapter = adapterFor(file);
    for (const re of facts.reexports) {
      const target = adapter?.resolve(re.specifier, file);
      if (!target) {
        continue;
      }
      if (re.names === "*") {
        if (name === "default") {
          continue;
        }
        const r = await definingFile(target, name, seen, depth + 1);
        if (r) {
          return r;
        }
      } else {
        const hit = re.names.find((n) => n.as === name);
        if (hit) {
          return (
            (await definingFile(target, hit.from, seen, depth + 1)) ?? target
          );
        }
      }
    }
    return undefined;
  };

  const edgeMap = new Map<string, Edge>();
  const addEdge = (
    from: string,
    to: string,
    kind: EdgeKind,
    via: string,
    framework?: string,
  ) => {
    if (from === to || !nodes.has(from) || !nodes.has(to)) {
      return;
    }
    const key = `${from}\0${to}\0${kind}`;
    const e = edgeMap.get(key);
    if (e) {
      if (!e.via.includes(via)) {
        e.via.push(via);
      }
    } else {
      edgeMap.set(key, {
        from,
        to,
        kind,
        via: [via],
        ...(framework ? { framework } : {}),
      });
    }
  };
  const linked = new Set<string>();

  // ── Structural edges from adapters ───────────────────────────────────────
  onStep({ step: "follow", files: 0 });
  await Promise.all(
    [...nodes].flatMap(([path, { facts }]) =>
      targetsOf(path, [
        ...(facts?.imports ?? []),
        ...(facts?.reexports ?? []),
      ]).map(warm),
    ),
  );
  onStep({ step: "link" });
  for (const [path, node] of nodes) {
    const facts = node.facts;
    if (!facts) {
      continue;
    }
    const adapter = adapterFor(path)!;
    for (const imp of facts.imports) {
      const target = adapter.resolve(imp.specifier, path);
      if (!target) {
        continue;
      }
      if (imp.relation === "contains") {
        addEdge(path, target, "contains", basename(target));
        continue;
      }
      if (imp.names === "*") {
        addEdge(target, path, "import", "*");
      } else {
        for (const name of imp.names) {
          addEdge(
            (await definingFile(target, name)) ?? target,
            path,
            "import",
            name,
          );
        }
      }
    }
    for (const re of facts.reexports) {
      const target = adapter.resolve(re.specifier, path);
      if (!target) {
        continue;
      }
      if (re.names === "*") {
        addEdge(target, path, "import", "*");
        // A changed file reached through an unchanged barrel (export * from …).
        for (const n of (await factsOf(target))?.reexports ?? []) {
          const t2 = adapterFor(target)?.resolve(n.specifier, target);
          if (t2) {
            addEdge(t2, path, "import", "*");
          }
        }
      } else {
        for (const n of re.names) {
          addEdge(
            (await definingFile(target, n.from)) ?? target,
            path,
            "import",
            n.as,
          );
        }
      }
    }
  }
  // ── Framework edges ──────────────────────────────────────────────────────
  for (const [path, byRule] of frameworkFacts) {
    for (const { rule, facts } of byRule) {
      for (const part of facts.parts ?? []) {
        addEdge(path, part, "contains", basename(part), rule);
      }
      for (const d of facts.dependsOn ?? []) {
        addEdge(d.path, path, "framework", d.via, rule);
      }
    }
  }

  for (const e of edgeMap.values()) {
    linked.add(`${e.from}\0${e.to}`);
    linked.add(`${e.to}\0${e.from}`);
  }

  // ── Name edges (language-agnostic) ──────────────────────────────────────
  const skip = (role: string) => role === "docs" || role === "lockfile";
  // Only hand-written files count as definers: generated files (schema dumps,
  // generated clients) restate every name and would link everything to everything.
  const definers = new Map<string, Set<string>>();
  /** Names a framework rule defined, with the rule's name. */
  const ruleOf = new Map<string, string>();
  const defined = new Map<string, Set<string>>();
  for (const [path, node] of nodes) {
    if (skip(node.role) || node.role === "generated") {
      continue;
    }
    const own = new Set<string>();
    for (const d of node.facts?.definitions ?? []) {
      own.add(d);
      if (distinctive(d)) {
        definers.set(d, (definers.get(d) ?? new Set()).add(path));
      }
    }
    for (const { rule, facts } of frameworkFacts.get(path) ?? []) {
      for (const d of facts.definitions ?? []) {
        own.add(d);
        if (distinctive(d, true)) {
          definers.set(d, (definers.get(d) ?? new Set()).add(path));
          if (!ruleOf.has(d)) {
            ruleOf.set(d, rule);
          }
        }
      }
    }
    defined.set(path, own);
  }
  // Other spellings of a defined name, mapped to the name as defined.
  const respelled = new Map<string, Set<string>>();
  for (const d of definers.keys()) {
    const sp = spelling(d);
    if (sp) {
      respelled.set(sp, (respelled.get(sp) ?? new Set()).add(d));
    }
  }
  const mentions = new Map<string, Set<string>>();
  const mentionCount = new Map<string, number>();
  for (const [path, node] of nodes) {
    if (skip(node.role) || node.file.binary) {
      continue;
    }
    const { added, removed } = changedLines(node.file);
    const tokens = new Set<string>();
    for (const line of [...added, ...removed]) {
      for (const m of line.matchAll(IDENT)) {
        if (definers.has(m[0])) {
          tokens.add(m[0]);
          continue;
        }
        const sp = spelling(m[0]);
        for (const d of (sp && respelled.get(sp)) || []) {
          tokens.add(d);
        }
      }
      for (const m of line.matchAll(STRING_KEY)) {
        if (m[2] && definers.has(m[2])) {
          tokens.add(m[2]);
        }
      }
      for (const m of line.matchAll(KEBAB)) {
        if (definers.has(m[0])) {
          tokens.add(m[0]);
        }
      }
    }
    mentions.set(path, tokens);
    for (const t of tokens) {
      mentionCount.set(t, (mentionCount.get(t) ?? 0) + 1);
    }
  }
  const maxMentions = Math.max(6, Math.ceil(nodes.size * 0.3));
  for (const [path, tokens] of mentions) {
    const ownDefs = defined.get(path) ?? new Set<string>();
    for (const t of tokens) {
      if (ownDefs.has(t) || (mentionCount.get(t) ?? 0) > maxMentions) {
        continue;
      }
      const from = definers.get(t)!;
      if (from.size > 2) {
        continue; // ambiguous name
      }
      for (const d of from) {
        if (linked.has(`${d}\0${path}`)) {
          continue;
        }
        addEdge(d, path, "name", t, ruleOf.get(t));
      }
    }
  }

  return { nodes, edges: [...edgeMap.values()] };
}

interface RuleFacts {
  rule: string;
  facts: FrameworkFacts;
}

function basename(p: string): string {
  return p.slice(p.lastIndexOf("/") + 1);
}
