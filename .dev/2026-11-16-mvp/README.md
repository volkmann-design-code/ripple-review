---
effort: mvp
status: active
started: 2026-11-16
updated: 2026-11-16
owner: Enzo Volkmann
phases:
  - 00-cli-prototype
  - 01-tooling-and-ci
  - 02-tests-and-fixtures
  - 03-evaluation-corpus
  - 04-ai-layer
  - 05-more-adapters
  - 07-web-app
  - 06-github-app
  - 08-public-repo
---

# ripple-review MVP

## Goal

A reviewer reads a change from its core (contract, schema, migration,
library) outwards to its consumers, not in alphabetical order. ripple-review
suggests that order: the change split into stories, each in dependency order,
mechanical edits read as one item, generated files set aside. A static
analysis backbone (imports, definitions, names) does most of it, and an AI
layer on top names the stories and places what the graph can't (D2). In the
end it runs as a GitHub App on every PR (D4).

## Today

- `00` done (`39ba603`): a CLI (`bun src/cli.ts owner/repo#123`, or
  `--repo <dir> --base <ref>`) with a language-agnostic core and adapters
  for TypeScript/JS, SQL and GraphQL (D3). On a private 88-file PR
  (TypeScript, SQL, GraphQL) it produces 9 groups in ~2 s; an example of
  the output (on a public PR) in [`examples/spartan-1845.md`](../../examples/spartan-1845.md).
- `01` done (PR #2): Nx workspace (`apps/cli`, `libs/core`, `libs/sources`,
  `libs/report`, `libs/adapter-*`; D11), renamed to `ripple-review` /
  `ripple` (D10), Biome, lefthook, CI on GitHub Actions.
- `02` done (PR #3): Vitest unit tests in every project (D12), an adapter
  contract suite, `--record` / `--fixture`, recorded fixtures with a golden
  review order (D13): the 88-file private PR and ripple-review#3
  (dogfooding). Since phase 08 the committed fixtures are public PRs
  (`hono-5556`, `spartan-1845`, `umami-1376`); the private ones live in
  the gitignored `local/fixtures/` and run when present.
- `03` done: an evaluation corpus of 28 merged PRs from three repositories
  (`bun corpus`, kept in the gitignored `local/corpus/`; D14–D17) with the
  user's notes, and the static fixes they led to: constant folding for
  mechanical edits, config before the code it sets up, generated files by
  size and by generator configs, string keys and snake/camel spellings as
  name links. Three more private fixtures.
- `04` done: AI layer behind a provider-independent port (D18), opt-in by
  `--ai` (D19). Opus 5.5 at medium effort reads a summary of the static
  order and asks for diffs only when it needs them (D20, ~0.09 USD per PR);
  it names the groups, reorders them, moves files where the graph couldn't
  and flags weak links, applied as a validated patch. Corpus orders with AI
  in `local/corpus/*.ai.md`, notes pending.
- After 04: Angular components read with their template and styles, and
  linked to the templates that bind their selector, inputs and outputs;
  independent stories ordered schema first.
- `07` in progress (D21): a web app, `bun dev` → http://localhost:4200,
  the review pipeline shared with the CLI in `libs/engine`. Browser-only
  (D22): no server, the user's own tokens and keys, data in the browser or
  with the forge. Done: core and engine runtime-neutral with an async
  `Snapshot`; GitHub through its API (`libs/forge-github`); the engine in a
  Web Worker with settings and IndexedDB, `apps/server` removed; ticks
  synced with GitHub's "Viewed"; progress and saved reviews; reviews
  written and submitted on GitHub (D23); deployed as static files after
  every green CI on main (D24). Next: GitLab.
- `08` done (D25): public under FSL-1.1-MIT since 2026-11-16, a fresh
  repository from a cleaned tree; private fixtures and the corpus kept
  locally in `local/`.

- Framework rules (graphile-migrate, Angular, graphile-worker,
  PostGraphile, Kirby) continue in their own effort,
  [`2026-11-17-framework-rules`](../2026-11-17-framework-rules/README.md).

## Phases

| #  | Phase | Status |
|----|-------|--------|
| 00 | [CLI prototype](phases/00-cli-prototype.md) | done |
| 01 | [Nx workspace, lefthook, Biome, CI](phases/01-tooling-and-ci.md) | done |
| 02 | [Tests and recorded fixtures](phases/02-tests-and-fixtures.md) | done |
| 03 | [Evaluation corpus: 20–30 real PRs](phases/03-evaluation-corpus.md) | done |
| 04 | [AI layer](phases/04-ai-layer.md) | done |
| 05 | [More adapters (tree-sitter)](phases/05-more-adapters.md) | todo |
| 07 | [Web app: local first, hosted browser-only](phases/07-web-app.md) | in-progress (before 06, D21, D22) |
| 06 | [GitHub App: sticky PR comment](phases/06-github-app.md) | todo |
| 08 | [Public repository](phases/08-public-repo.md) | done (D25) |

Order: 01 → 02 → 03; 04 and 05 are driven by what 03 finds; 07 (web app)
before 06 (D21), and the tree-sitter base of 05 after it.

## Known weaknesses (from the 88-file private PR)

- Story titles are mechanical ("Around `x.ts`, `y.ts` (libs/db)") without
  `--ai`.
- Name links are heuristic: a mention in a comment counts like a call.
- Barrel files are followed through the whole repository: in a large
  monorepo a PR reads ~1 500 files, ~10 s through GitHub's API (~2 s with
  git).
- Docs all go to "Context", even a README touched by one story.

## Resuming

Read this file, the latest `log.md` entry, then the next `todo` phase.
`bun install && bunx nx run-many -t test:unit` checks that everything still
works offline, including the fixtures' golden orders (and those in
`local/fixtures/`, if present); `bun ripple honojs/hono#5556` runs on a live
PR (needs a GitHub token: `GITHUB_TOKEN`, or `gh` signed in).
