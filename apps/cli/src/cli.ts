#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { refine } from "@ripple-review/core/ai";
import { ForgeError } from "@ripple-review/core/forge";
import type { ChangeSet } from "@ripple-review/core/model";
import { aiInput, cached, modelFor, usageLine } from "@ripple-review/engine/ai";
import { aiCacheDir, FileStore } from "@ripple-review/engine/node/file-store";
import { review } from "@ripple-review/engine/review";
import { GitHubForge } from "@ripple-review/forge-github";
import { renderMarkdown } from "@ripple-review/report/markdown";
import { loadFixture, recordFixture } from "@ripple-review/sources/fixture";
import { githubToken } from "@ripple-review/sources/github-token";
import { loadLocal } from "@ripple-review/sources/local";

const USAGE = `Usage:
  ripple <github-pr>                 e.g. owner/repo#123 or a pull request URL
                                     (GitHub's API with GITHUB_TOKEN or \`gh auth token\`)
  ripple --repo <dir> --base <ref> [--head <ref>]
  ripple --fixture <dir>             a change recorded with --record

Options:
  --format md|json   output format (default md)
  --debug            print the dependency edges to stderr
  --record <dir>     save the change (diff and the files read) as a fixture
  --ai               let a model name the groups and refine the order (off by
                     default; sends the diff to the provider; needs
                     ANTHROPIC_API_KEY or \`ant auth login\`)
  --no-ai            the static order only (the default)
  --ai-model <m>     model, optionally with a provider prefix
                     (default anthropic:claude-opus-5-5)
  --ai-effort <e>    low, medium (default), high, xhigh or max
  --ai-input <i>     summary (default): names and first lines per file, and
                     the model reads the diffs it needs; full: the trimmed
                     diff of every file
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    repo: { type: "string" },
    base: { type: "string" },
    head: { type: "string", default: "HEAD" },
    fixture: { type: "string" },
    record: { type: "string" },
    format: { type: "string", default: "md" },
    debug: { type: "boolean", default: false },
    ai: { type: "boolean", default: false },
    "no-ai": { type: "boolean", default: false },
    "ai-model": { type: "string" },
    "ai-effort": { type: "string" },
    "ai-input": { type: "string" },
    help: { type: "boolean", short: "h", default: false },
  },
});

const log = (m: string) => process.stderr.write(`${m}\n`);

async function load(): Promise<ChangeSet> {
  if (values.fixture) {
    return loadFixture(values.fixture);
  }
  if (values.repo) {
    if (!values.base) {
      throw new Error("--base is required with --repo");
    }
    return loadLocal(values.repo, values.base, values.head!);
  }
  const forge = new GitHubForge({ token: githubToken() });
  const ref = positionals[0] && forge.parseChange(positionals[0]);
  if (!ref) {
    throw new Error(USAGE);
  }
  return forge.loadChange(ref, { stage: (m) => log(`${m}…`) });
}

if (values.help) {
  process.stdout.write(USAGE);
  process.exit(0);
}

try {
  const t0 = performance.now();
  const loaded = await load();
  const recording = values.record ? recordFixture(loaded) : undefined;
  const cs = recording?.cs ?? loaded;
  const { analysis, edges, ...plan } = await review(cs);
  let groups = plan.groups;
  if (values.ai && !values["no-ai"]) {
    const aiStore = new FileStore(aiCacheDir());
    const model = modelFor(values["ai-model"], values["ai-effort"], (u) =>
      log(usageLine(u)),
    );
    const result = await refine(
      cached(model, aiStore, (key) =>
        log(`AI answer from the cache: ${aiStore.path(key)}`),
      ),
      cs,
      groups,
      edges,
      { input: aiInput(values["ai-input"]), nodes: analysis.nodes },
    );
    groups = result.groups;
    if (values.debug) {
      log(`read with read_diff: ${result.reads.join(", ") || "nothing"}`);
      for (const e of result.weakEdges) {
        log(`weak link ${e.from} → ${e.to}: ${e.reason}`);
      }
      for (const i of result.ignored) {
        log(`ignored from the AI answer: ${i}`);
      }
    }
  }
  if (recording && values.record) {
    await recording.save(values.record);
    log(`recorded the change in ${values.record}`);
  }
  if (values.debug) {
    for (const e of edges) {
      log(
        `${e.kind.padEnd(13)} ${e.from} → ${e.to}  [${e.via.slice(0, 4).join(", ")}]`,
      );
    }
    for (const [p, n] of analysis.nodes) {
      log(`role ${n.role.padEnd(12)} ${p}`);
    }
  }
  if (values.format === "json") {
    process.stdout.write(
      `${JSON.stringify({ title: cs.title, url: cs.url, groups }, null, 2)}\n`,
    );
  } else {
    process.stdout.write(renderMarkdown(cs, groups));
  }
  log(
    `analyzed ${analysis.nodes.size} files in ${Math.round(performance.now() - t0)} ms`,
  );
} catch (err) {
  log(err instanceof Error ? err.message : String(err));
  if (err instanceof ForgeError && err.hint) {
    log(err.hint);
  }
  process.exit(1);
}
