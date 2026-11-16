#!/usr/bin/env bun
/*
 * Runs the review on every PR of the evaluation corpus (D14–D16) and writes,
 * per PR, the order followed by the user's notes, plus a table of measures.
 *
 *   <data>/corpus.json        the PRs: repo, number, shape, why
 *   <data>/<repo>-<n>.md      the order; the "## Notes" section is kept across runs
 *   <data>/measures.json      the measures of the last run, kept so a fix
 *                             shows what it changed
 *   <data>/README.md          the table, between the measures markers
 *   <data>/<repo>-<n>.ai.md   with --ai: the order the AI layer made of it, with
 *                             its own notes, and what the call cost
 *
 * <data> is local/corpus by default, gitignored: a corpus of private
 * repositories must not be committed. Recordings live in
 * ~/.cache/ripple-review/corpus/ and are made on first use.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { type AiUsage, refine } from "@ripple-review/core/ai";
import type {
  ChangeSet,
  Edge,
  FileNode,
  ReviewGroup,
} from "@ripple-review/core/model";
import { aiInput, cached, modelFor, usageLine } from "@ripple-review/engine/ai";
import { type Measures, measure } from "@ripple-review/engine/measures";
import { aiCacheDir, FileStore } from "@ripple-review/engine/node/file-store";
import { review } from "@ripple-review/engine/review";
import { GitHubForge } from "@ripple-review/forge-github";
import { renderMarkdown } from "@ripple-review/report/markdown";
import { loadFixture, recordFixture } from "@ripple-review/sources/fixture";
import { githubToken } from "@ripple-review/sources/github-token";

interface CorpusPr {
  repo: string;
  number: number;
  shape: string;
  why: string;
}

const USAGE = `Usage: bun corpus [--data <dir>] [--refresh] [--ai [--ai-model <m>] [--ai-effort <e>] [--ai-input full|summary]] [<repo>-<n> …]

Reviews the corpus PRs (all, or the ones named) and rewrites their orders,
measures.json and the table in README.md. --refresh records again. --ai also
writes <repo>-<n>.ai.md, the order after the AI layer (answers are cached).
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    data: { type: "string", default: "local/corpus" },
    refresh: { type: "boolean", default: false },
    ai: { type: "boolean", default: false },
    "ai-model": { type: "string" },
    "ai-effort": { type: "string" },
    "ai-input": { type: "string" },
    help: { type: "boolean", short: "h", default: false },
  },
});
if (values.help) {
  process.stdout.write(USAGE);
  process.exit(0);
}

const log = (m: string) => process.stderr.write(`${m}\n`);
const data = values.data ?? "local/corpus";
const NOTES = "## Notes";
const NOTES_PLACEHOLDER =
  "<!-- What feels wrong with this order? Plain words are enough. -->\n";
const TABLE_START = "<!-- measures:start -->";
const TABLE_END = "<!-- measures:end -->";

const idOf = (pr: CorpusPr) => `${pr.repo.split("/")[1]}-${pr.number}`;

function cacheDir(pr: CorpusPr): string {
  const base = process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache");
  return join(base, "ripple-review", "corpus", pr.repo, String(pr.number));
}

function readJson<T>(path: string, fallback: T): T {
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as T)
    : fallback;
}

/** Reviews one PR, recording it first if the cache doesn't have it. */
async function run(pr: CorpusPr): Promise<{
  cs: ChangeSet;
  nodes: Map<string, FileNode>;
  groups: ReviewGroup[];
  edges: Edge[];
  markdown: string;
  measures: Measures;
}> {
  const dir = cacheDir(pr);
  if (values.refresh || !existsSync(join(dir, "meta.json"))) {
    const forge = new GitHubForge({ token: githubToken() });
    const recording = recordFixture(
      await forge.loadChange(
        { repo: pr.repo, number: pr.number },
        { stage: (m) => log(`${m}…`) },
      ),
    );
    await review(recording.cs);
    await recording.save(dir);
    log(`recorded in ${dir}`);
  }
  const cs = loadFixture(dir);
  const { analysis, groups, edges } = await review(cs);
  return {
    cs,
    nodes: analysis.nodes,
    groups,
    edges,
    markdown: renderMarkdown(cs, groups),
    measures: measure(groups, edges),
  };
}

const pct = (x: number | undefined) =>
  x === undefined ? "–" : `${Math.round(x * 100)} %`;

function measuresLine(m: Measures): string {
  return (
    `**Measures:** ${m.stories} stories · ${pct(m.standalone)} standalone · ` +
    `${pct(m.testsPlaced)} of tests placed · ${m.mechanical} mechanical ${m.mechanical === 1 ? "group" : "groups"} · ` +
    `${pct(m.unlinked)} of reviewed files without an edge`
  );
}

/** Writes the order above the notes, keeping whatever the notes say. */
function writeOrder(
  path: string,
  pr: CorpusPr,
  markdown: string,
  m: Measures,
  extra = "",
) {
  const old = existsSync(path) ? readFileSync(path, "utf8") : "";
  const at = old.lastIndexOf(`\n${NOTES}\n`);
  const notes =
    at >= 0 ? old.slice(at + 1) : `${NOTES}\n\n${NOTES_PLACEHOLDER}`;
  const head =
    `<!-- Written by \`bun corpus\`: everything above "${NOTES}" is replaced on each run. -->\n` +
    `<!-- shape: ${pr.shape} · why: ${pr.why} -->\n\n`;
  writeFileSync(
    path,
    `${head}${markdown}\n${measuresLine(m)}\n${extra}\n${notes}`,
  );
}

function table(corpus: CorpusPr[], all: Record<string, Measures>): string {
  const rows = corpus.flatMap((pr) => {
    const m = all[idOf(pr)];
    return m === undefined
      ? []
      : `| [${idOf(pr)}](${idOf(pr)}.md) | ${pr.shape} | ${m.files} | ${m.groups} | ${m.stories} | ${pct(m.standalone)} | ${pct(m.testsPlaced)} | ${m.mechanical} | ${pct(m.unlinked)} |`;
  });
  return [
    "| PR | shape | files | groups | stories | standalone | tests placed | mechanical | without an edge |",
    "|---|---|--:|--:|--:|--:|--:|--:|--:|",
    ...rows,
  ].join("\n");
}

function writeTable(corpus: CorpusPr[], all: Record<string, Measures>) {
  const path = join(data, "README.md");
  const old = readFileSync(path, "utf8");
  const start = old.indexOf(TABLE_START);
  const end = old.indexOf(TABLE_END);
  if (start < 0 || end < start) {
    throw new Error(`${path} needs the ${TABLE_START} … ${TABLE_END} markers`);
  }
  writeFileSync(
    path,
    `${old.slice(0, start + TABLE_START.length)}\n${table(corpus, all)}\n${old.slice(end)}`,
  );
}

/** What changed against the committed measures, one line per PR. */
function changes(
  id: string,
  was: Measures | undefined,
  now: Measures,
): string[] {
  if (!was) {
    return [`${id}: new`];
  }
  const diffs = (Object.keys(now) as (keyof Measures)[])
    .filter((k) => was[k] !== now[k])
    .map((k) => {
      const f = (v: number | undefined) =>
        k === "standalone" || k === "unlinked" || k === "testsPlaced"
          ? pct(v)
          : String(v);
      return `${k} ${f(was[k])} → ${f(now[k])}`;
    });
  return diffs.length ? [`${id}: ${diffs.join(", ")}`] : [];
}

const corpus = readJson<{ prs: CorpusPr[] }>(join(data, "corpus.json"), {
  prs: [],
}).prs;
const unknown = positionals.filter(
  (id) => !corpus.some((pr) => idOf(pr) === id),
);
if (unknown.length) {
  log(`not in corpus.json: ${unknown.join(", ")}`);
  process.exit(1);
}
const selected = positionals.length
  ? corpus.filter((pr) => positionals.includes(idOf(pr)))
  : corpus;

const measuresPath = join(data, "measures.json");
const before = readJson<Record<string, Measures>>(measuresPath, {});
const after: Record<string, Measures> = {};
for (const pr of corpus) {
  const m = before[idOf(pr)];
  if (m) {
    after[idOf(pr)] = m;
  }
}

const usage: AiUsage[] = [];
const model = values.ai
  ? cached(
      modelFor(values["ai-model"], values["ai-effort"], (u) => {
        usage.push(u);
        log(usageLine(u));
      }),
      new FileStore(aiCacheDir()),
      () => log("AI answer from the cache"),
    )
  : undefined;

let failed = 0;
const report: string[] = [];
for (const pr of selected) {
  const id = idOf(pr);
  log(`── ${id}`);
  try {
    const { cs, nodes, groups, edges, markdown, measures } = await run(pr);
    writeOrder(join(data, `${id}.md`), pr, markdown, measures);
    if (model) {
      const calls = usage.length;
      const input = aiInput(values["ai-input"]);
      const ai = await refine(model, cs, groups, edges, { input, nodes });
      const call = usage[calls];
      const extra = [
        `**AI:** ${model.id} · ${input} input · ${call ? usageLine(call) : "cached"}`,
        ...(input === "summary"
          ? [
              `- read: ${ai.reads.map((p) => `\`${p}\``).join(", ") || "nothing"}`,
            ]
          : []),
        ...ai.weakEdges.map(
          (e) => `- weak link \`${e.from}\` → \`${e.to}\`: ${e.reason}`,
        ),
        ...ai.ignored.map((i) => `- ignored: ${i}`),
      ]
        .map((l) => `${l}\n`)
        .join("");
      writeOrder(
        join(data, `${id}.ai.md`),
        pr,
        renderMarkdown(cs, ai.groups),
        measure(ai.groups, edges),
        `\n${extra}`,
      );
    }
    after[id] = measures;
    report.push(...changes(id, before[id], measures));
  } catch (err) {
    failed++;
    log(`${id} failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

writeFileSync(measuresPath, `${JSON.stringify(after, null, 2)}\n`);
writeTable(corpus, after);
log(
  report.length
    ? `\nChanged against measures.json:\n  ${report.join("\n  ")}`
    : "\nNo measure changed.",
);
if (usage.length) {
  const total = usage.reduce((s, u) => s + (u.costUsd ?? 0), 0);
  log(`${usage.length} AI calls, ~${total.toFixed(2)} USD`);
}
process.exit(failed ? 1 : 0);
