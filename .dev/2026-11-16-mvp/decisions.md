# Decisions

Append only. Each: what, why, when. Open questions at the end, each with a
recommendation; an answer becomes a D-entry and the question points at it.

## D1 Review order from the core outwards, as a product

GitHub and others list a change's files alphabetically, which puts consumers
(`apps/…`) before what they consume (`libs/…`). ripple-review orders them
from the core of the change (library, contract, DB migration, …) out to its
consumers. Splitting a change into its stories and setting aside generated
and mechanical edits matter as much as the order itself: in a private
88-file PR (TypeScript, SQL, GraphQL), a third of the added lines are
generated and the PR holds three side stories next to the feature.

**Why:** the user's idea (2026-11-16). Supported by research: files later in
the review order get fewer comments (Fregnan et al., FSE 2022); changesets can
be split by def-use links (ClusterChanges, Barnett et al., ICSE 2015).

## D2 Static analysis is the backbone, AI a layer on top

Imports, definitions and name links make a deterministic, reproducible graph,
and the order comes from it. The AI layer gets the graph, file stats and
trimmed hunks (not the whole diff) and does what the graph can't: name the
stories, place files without edges (config, docs), question weak links.

**Why:** cheap, explainable ("uses `x` from y.ts") and stable between runs;
AI-only tools (PR walkthroughs) already exist, and the difference here is
navigation from a deterministic base. The user had proposed the same
split (2026-11-16).

## D3 Language-agnostic core, languages as adapters

An adapter (`LanguageAdapter`) only parses a file (imports, re-exports,
exports, definitions) and resolves import specifiers to repository paths.
Barrel following, cross-language name links, classification, mechanical-edit
detection, clustering and ordering are shared. Name links work across
languages even for files without an adapter.

**Why:** "The tool should be language agnostic in the end, so maybe we need
a kind of adapter system and a general code" (user, 2026-11-16).

## D4 Delivery: CLI, then a GitHub App comment, a UI last

1. CLI, to test the idea on real PRs.
2. GitHub App: on `pull_request` opened/synchronize, a sticky comment with
   the order as a checklist; every entry links to the file's anchor in
   "Files changed" (`#diff-<sha256(path)>`), so no UI of our own is needed.
3. Only if 2 proves the value: a browser extension that reorders GitHub's
   file tree, or our own diff viewer.

**Why:** the comment fits the existing review flow at almost no cost; an
extension breaks with GitHub's DOM, and our own viewer is a large build
(comments, sync). The user framed it as "maybe a webapp connected to
github" and agreed to start with the CLI (2026-11-16).

## D5 Stories are Louvain communities; tests and helpers follow their subject

Code files (no tests, no config, no generated files) are clustered with
Louvain on the weighted dependency graph (import 1, contains 1, via-generated
0.75, name 0.5). A mechanical group joins as one node, so a refactor and its
ripple stay together. A single-file community joins its strongest neighbour.
Tests, then test helpers, go to the story they are most tied to. Stories are
ordered topologically; in a cycle the heavier direction wins, and smaller
stories go first.

**Why:** plain connected components gave one 44-file story for the
88-file PR; Louvain split it into two refactors, a type moved between
libraries (with its 17-file mechanical edit), a third refactor and the
feature's SQL and TS parts.

## D6 Generated files are set aside, not ordered

Generated files (`linguist-generated` in `.gitattributes`, `generated/`
paths, `@generated`/"do not edit" headers) and lockfiles go to a last group,
"check it matches its source". They don't define names (a schema dump
restates every name), and edges leave them only along real imports, so
SQL function → generated row type → TS caller becomes one edge.

**Why:** the first run let `schema.dump.sql` link everything to everything.

## D7 Name: ripple-review

The project is `volkmann-design-code/ripple-review`, created by the user
2026-11-16 (private at first, public since D25). It replaces the working name `semantic-codereview`.

## D8 Tech stack: Nx, Bun, lefthook, Biome

TypeScript on Bun, an Nx workspace, lefthook for git hooks and Biome for
lint and format, set up the way the user's other projects have them (`nx.json` target
defaults with cache, `nx affected` in CI, lefthook pre-commit running
`biome check --write` on staged files, Biome pinned in `package.json`).
The TypeScript adapter keeps using the TypeScript compiler API; other
languages get tree-sitter (D9).

**Why:** the user's choice (2026-11-16): one toolchain across their
projects.

## D9 CI on GitHub Actions

**Changed by:** D25 (GitHub-hosted runners).

CI first ran on self-hosted runners, every job gated to same-repo events,
since such runners must not run code from forked PRs. For the public
repository it moved to GitHub-hosted runners (D25).

**Why:** the user's choice (2026-11-16).

## D10 Package `ripple-review`, CLI `ripple`

Root package `ripple-review`, workspace packages `@ripple-review/<project>`,
the CLI binary `ripple` (`bun ripple …` in the repo), cache in
`~/.cache/ripple-review/`. Answers O1.

**Why:** follows the repo name (D7); `ripple` is short to type and matches.
Recommended in O1 and taken in phase 01 (2026-11-16).

## D11 Workspace layout and imports

`apps/cli`, `libs/core`, `libs/sources`, `libs/report`,
`libs/adapter-<lang>`. Cross-project imports use subpath package names
(`@ripple-review/core/graph`, one per file, no barrel `index.ts`), resolved
by the root `tsconfig.json` `paths` (tsc and Bun) and each package's
`exports` (`"./*": "./src/*.ts"`). No workspace dependencies in
`package.json`; Nx infers the project graph from imports. `libs/core`
imports no other project, enforced by Biome. Nx's lockfile analysis is off
(`analyzeLockfile: false`): Nx 22.7 can't parse the v2 `bun.lock` Bun 1.4
writes for a new lockfile, and the project graph
doesn't need it.

**Why:** the dependency rule of D3 becomes visible in the project graph and
checked in CI; subpath imports keep each file's dependencies explicit,
as a no-re-export rule would.

## D12 Vitest, run by Bun

Vitest 4.1.12 run as `bun --bun vitest run src` from each project's
`test:unit` script, with a root `vitest.shared.ts` that each project's
`vitest.config.ts` calls. Test
files sit next to the code (`*.test.ts`). Biome's `noNonNullAssertion` is off
for test files: a wrong `!` there fails the test anyway. Answers O2.

**Why:** one test setup across the user's projects (D8); `nx affected` and its
cache work through the `test:unit` target as for typecheck.

## D13 Recorded fixtures for offline end-to-end tests

`ripple … --record <dir>` saves a change as it was analyzed: `meta.json`
(title, url), `diff.patch`, `tree.txt.gz` (every path at head) and
`files.json.gz` (only the files the analysis read). `ripple --fixture <dir>`
and the tests replay it through a `MemorySnapshot`, without git or `gh`.
Each fixture in `apps/cli/fixtures/` has a golden `expected.md`.
The two large files are gzipped: the 88-file PR's analysis reads 1,577
files (12 MB, 9 MB of them generated schemas), 1.6 MB gzipped. A fixture
holds copies of the recorded repository's source: since D25 the committed
ones are public PRs, and recordings of private repositories stay in the
gitignored `local/fixtures/`, which the golden tests run when present.

**Why:** the analysis depends on far more than the diff (barrels, tsconfigs,
package.json files), so an offline test needs those files; storing only what
was read keeps it small and still byte-identical to the live run. A replay
reads nothing else, so if a code change makes the analysis read a new file,
the fixture must be re-recorded (it shows up as a golden diff).

## D14 The corpus is refs and notes; recordings stay in a local cache

The corpus is only the list of PRs and the user's notes on each (first in
`.dev/…/data/corpus/`, since D25 in the gitignored `local/corpus/`, as its
PRs are of private repositories). Recordings (D13) are made on demand into
`~/.cache/ripple-review/corpus/` (merged PRs don't change) and never
committed; a handful of PRs may be promoted to fixtures. Evaluation runs need network and `gh`, unit
tests don't.

**Why:** the user's choice (2026-11-16). 20–30 recordings would add
~30–50 MB to git; this keeps the repo small and the source of other
repositories out of it.

## D15 Feedback as free-text notes per PR

For each corpus PR the user writes in plain words what feels wrong with the
order (`<repo>-<n>.md` in the corpus folder, below the generated order). Findings are
drawn from the notes; tracked measures are the ones computed without a
reference order: groups, share of files in "Standalone", stories, tests
placed with their subject, mechanical groups, files without edges.

**Why:** the user's choice (2026-11-16): less work per PR than rearranging
each order into a reference. **Changes:** phase 03's "inversions against the
user's order" measure is dropped.

## D16 Corpus PRs: proposed by shape, vetoed by the user

The candidates are picked from merged PRs by their file lists, covering the
shapes DB-heavy, frontend-only, refactor, mixed stories, small (< 10 files)
and large (> 80 files); the user strikes or swaps before anything is
recorded.

**Why:** the user's choice (2026-11-16); they know which PRs they remember
well enough to judge.

## D17 Corpus repositories

Three private repositories of the user's work:
- a large monorepo in TS, SQL and GraphQL: the main corpus (19 PRs);
- a mostly PHP project (no adapter yet) with some TS (4 PRs);
- a project in TS, PLpgSQL and Dart (no adapter for Dart; 5 PRs).

Mixed coverage is intended: PRs in the latter two show what a missing
adapter costs and feed phase 05.

**Why:** the user's choice (2026-11-16).

## D18 AI layer: provider-independent core, one library per provider, no framework

`libs/core` defines a small `ReviewModel` port and everything that does not
depend on a provider: the prompt input built from the analysis (stories,
files, roles, edges with their names, stats, trimmed hunks), the JSON schema
of the answer, validating and applying the answer as a patch (unknown files
ignored, every file still listed once), and caching by diff hash. No
dependency; tests use a fake provider. Each provider is its own library
(`libs/ai-<provider>`), like the language adapters. The first is
`libs/ai-anthropic` on the official `@anthropic-ai/sdk`, default model
`claude-opus-5-5`, configurable; the model to use is chosen by quality and
cost on the corpus (03). No agent framework (Mastra, Genkit): the layer is
one structured call per PR, not an agent loop. More providers later through
one more library, e.g. on the Vercel AI SDK.

**Why:** the user's choice (2026-11-16): provider-independent, Anthropic
first. A framework would add a large dependency tree, lag behind provider
features (structured outputs, caching, effort) and leak its types into the
core. Worth revisiting only if ripple turns agentic (a model exploring the
repository with tools).

## D19 The AI layer is opt-in by a flag

`--ai` / `--no-ai` and `--ai-model <id>` (later also a config entry). Off by
default while phase 04 runs; whether it becomes the default is decided by the
corpus comparison (with and without). Unit tests and golden fixtures always
run without it.

**Why:** the user's choice (2026-11-16): a flag to enable and disable it is
needed; off by default keeps the CLI deterministic, offline and free until
the AI's value is measured. Sending hunks to a provider also sends code from
the reviewed repository, which should be a deliberate choice per run.

## D20 Default model: Opus 5.5 at medium effort, on a summary of the change

`--ai` uses `claude-opus-5-5` at effort `medium` with the summary input:
the static order, the links, and per file the names its diff touches and
its first changed lines; the model reads full diffs with a `read_diff` tool
when it needs them (budgeted). `--ai-model`, `--ai-effort` and
`--ai-input full` stay available. The corpus may be sent to the API, all
three organizations included.

**Why:** compared on six PRs (phase 04): Opus restructured best (moves,
weak links) and was as good on the summary as on the full diff, at ~0.09
USD per PR instead of ~0.23; Sonnet 5.5 named well but moved little; Haiku
5.5 broke rules. Effort barely changes the cost, which input dominates.
Agreed by the user on 2026-11-16, also which corpus repositories may be
sent.

## D21 A web app before the GitHub Action: Angular, local first, hosted later

The next interface is our own web app, not the PR comment: `apps/web`
(Angular 22) on `apps/server` (Hono on Bun), sharing the
review pipeline with the CLI through `libs/engine`. v1 runs locally (GitHub
through `gh`, no sign-in, bound to 127.0.0.1); the same code is to run as a
hosted product later, with GitHub sign-in through the GitHub App of 06.

**Why:** the user's choice (2026-11-16): to try ripple-review as a proper
app on real PRs, an interface matters more than the comment; Angular because
the user's projects use it. One server serving both the API and the built
app keeps a hosted deployment to one container.

## D22 Hosted means browser-only: no server, no storage of ours

The hosted product is static files. Everything runs in the user's browser
with the user's own credentials: the engine (in a Web Worker), the forge
API calls (GitHub first) with the user's token, the AI calls with the
user's key (Anthropic allows direct browser calls). What has to be kept
stays in the browser (IndexedDB) or with the forge (GitHub's "viewed"
state); users may bring their own storage later through the same `Store`
port. Our infrastructure never sees a token, code or an answer.

Consequences:
- `libs/core` and `libs/engine` are runtime-neutral: no `node:` or Bun
  modules (Biome enforces it; Node-only parts of the engine live in
  `libs/engine/src/node/`). Paths are our own helpers, hashes Web Crypto.
- `Snapshot` is async (`list`, `read`, optional `prefetch`), so it can sit
  on a forge API as well as on git. Adapters get the path set in an async
  `init` and resolve synchronously against it.
- Where a change comes from is a forge adapter (`libs/forge-<name>`, a
  `Forge` port): GitHub, then GitLab and self-hosted instances by base URL.
  Forges differ in what they offer beyond reading a change, so syncing
  "viewed" or posting a review are optional capabilities the UI asks for.
  Self-hosted forges must allow CORS themselves; we don't relay.
- `apps/server` goes away once the web app runs the engine itself; the CLI
  stays a Node/Bun program on the same libs.
- Large repositories and API rate limits are ignored for now.

Not done instead: a stateless relay server (tokens and code would pass
through it); a database (nothing worth keeping is ours to keep); git in
the browser via WebAssembly (cloning from github.com needs a CORS proxy,
i.e. a server).

**Why:** the user's direction (2026-11-16): credentials stay with the
users, little or no storage of ours, so the app can be hosted
privacy-friendly and for free; "no server at all sounds like the cleanest
solution".

## D23 Review drafts live in the forge's pending review

Comments the reviewer writes in the app go straight into their pending
review on the forge (GitHub starts one with the first comment), not into
the app: the forge keeps them, the reviewer sees them in the forge's own
UI too, and nothing of ours stores them (D22). Submitting sends the
pending review with a summary as a comment, an approval or a request for
changes. Reviews are an optional capability on `Forge` (`reviews`) that
says what the forge supports: ranges of lines, comments on a file, the
ways to submit; the page offers only those, and none of it on a forge (or
a fixture) without reviews.

Consequences:
- What the forge doesn't take, because the token may only read or the
  forge can't be reached, waits in the browser (IndexedDB `drafts`, as
  add/edit/delete operations) and is sent on the next load, like the
  ticks. A comment the forge refuses for its place (lines outside the
  diff) fails at once instead and isn't kept.
- The summary stays in the browser until submitted: GitHub doesn't let a
  pending review have one before (`updatePullRequestReview` refuses an
  empty review's body).
- A review isn't submitted while drafts are still only in the browser.
- Only lines of the diff's hunks take comments (lines opened from a gap
  don't: GitHub refuses them); a range stays within one hunk.
- The change's existing threads show read-only next to their lines;
  replying and resolving come later.

**Why:** the user's choice (2026-11-16) between drafts kept in the app
and sent on submit, and drafts in GitHub's pending review: "GitHub
pending review", with a first version that writes (lines, ranges, files,
summary, submit) and shows existing threads.

## D24 Deploy: static files over SSH, settings only in GitHub secrets

The web app is deployed by `.github/workflows/deploy.yml` after every
green CI run on main (and by hand for any ref, also the rollback): built
on a GitHub-hosted runner, copied with tar over SSH, swapped in place with
`index.html` last. The bundles of the previous release stay, for tabs
still open on it that load a lazy chunk; older ones are deleted. The host
needs nothing but SSH, tar and Apache with `.htaccess`
(`apps/web/public/.htaccess`: routes to `index.html`, a strict CSP,
immutable caching of the hashed bundles).

Consequences:
- Everything about the host (address, user, password, path, URL) is a
  secret of the `production` environment, none a variable: the repository
  is to be public, and public Actions logs print variables in clear.
- The CSP allows scripts only from the app's origin and network only to
  `api.github.com` and `api.anthropic.com`, since the user's token and key
  live in this origin. Angular's critical-CSS inlining is off: it adds an
  inline script. A self-hosted forge (D22) will need its origin added.
- The deploy job runs on `ubuntu-latest`, a GitHub-hosted runner, as all
  CI does since D25.

**Why:** the user's direction (2026-11-16): any static host reached by
SSH will do, and a repository that can be made public with no hint of the
hosting in it.

## D25 Public repository under FSL-1.1-MIT

The repository is public under the Functional Source License
(FSL-1.1-MIT, licensor Enzo Volkmann): anyone may read, run and change it
for any purpose but a competing commercial product, and each version
becomes MIT two years after its release. It starts as a fresh repository
from a cleaned tree with one initial commit; the private one, whose
history and PR descriptions mention private repositories, is renamed and
archived.

Consequences:
- Recordings of private repositories are not committed: they live in the
  gitignored `local/fixtures/` (the golden tests run them when present)
  and the corpus in `local/corpus/` (`bun corpus`' default). The committed
  fixtures are three small public PRs: `hono-5556` (TypeScript),
  `umami-1376` (SQL migrations and their consumers) and `spartan-1845`
  (Angular).
- `SAVED_REVIEWS.goldens` hashes the committed fixtures only, so CI and a
  machine with `local/` agree.
- No hints of private repositories or of the hosting in code, docs or
  `.dev/`.
- CI runs on GitHub-hosted runners (**Changes:** D9): self-hosted runners
  shouldn't serve a public repository, and hosted ones are free for it.

**Why:** the user's choice (2026-11-16), over keeping it private: the code
ships to every browser anyway, and users can check that their token and
key stay in the browser; FSL keeps others from selling it as a competing
service while the product may still become one.

## Open questions

### O1 The CLI's name

Answered by D10.

### O2 Test runner

Answered by D12.

### O3 AI provider and cost

Answered by D18 and D19; the model is chosen in phase 04 by quality and cost
on the corpus.

### O4 Where the GitHub App runs

Needs a webhook endpoint, a clone cache and the AI key. **Recommendation:**
decide in phase 06; first candidate is a GitHub Actions variant (run in
the PR's own CI, post the comment), which needs no hosting of ours (D22);
a hosted app only if that falls short.
