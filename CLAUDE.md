# ripple-review

Suggests the order in which to review a change (see `README.md`). Plans,
decisions and session logs live in `.dev/` (convention in `.dev/README.md`);
read the active effort's `README.md` before starting work.

## Stack

Bun (pinned in `package.json` `packageManager`), an Nx workspace with Bun
workspaces, Biome for lint and format, lefthook for git hooks.

## Layout

- `apps/cli`: argument parsing and wiring for the CLI and `bun corpus`
- `apps/web`: the Angular web app, no
  server (D22): `src/engine/` runs the engine in a Web Worker
  (`engine.worker.ts`, `Backend`), with the user's GitHub token and
  Anthropic key from the settings page and IndexedDB stores (ticks, AI
  answers, file contents by blob SHA, saved reviews, drafts, the changes
  opened; listed and deletable in Settings); the page talks to it through
  `EngineService`
- `libs/engine`: the review pipeline shared by the CLI and the web app;
  `adapters.ts` registers the adapters; `src/node/` holds its only
  Node/Bun code (the file store)
- `libs/api-contract`: the types between the engine and the page
- `libs/core`: model, diff parsing, graph, classification, mechanical edits,
  clustering, ordering. Language-agnostic.
- `libs/forge-<name>`: a forge behind its API with the user's token
  (`Forge` in `libs/core/src/forge.ts`; D22), with optional capabilities
  (`viewed`: per-file "Viewed" marks, synced with the ticks; `reviews`:
  threads and the user's pending review, D23); GitHub so far
- `libs/sources`: Node-only sources (local git, recorded fixtures, the
  local GitHub token)
- `libs/adapter-<lang>`: one per language (`LanguageAdapter` in
  `libs/core/src/model.ts`)
- `libs/frameworks`: one rule per framework, a folder each (`src/<id>/`;
  `FrameworkRule` in
  `libs/core/src/framework.ts`), conventions across languages
  (graphile-migrate includes, …); detected from paths, runs in a browser
- `libs/report`: Markdown output
- `libs/ai-<provider>`: one per AI provider (`ReviewModel` in
  `libs/core/src/ai.ts`; D18); the AI layer is opt-in with `--ai` (D19)

Imports across projects use package paths (`@ripple-review/core/graph`),
mapped in the root `tsconfig.json`; inside a project, relative paths with
the `.ts` extension.

## Rules

- `libs/core` imports no other workspace project; adapters, sources and
  report depend on core, never the other way round (enforced by Biome's
  `noRestrictedImports` for `libs/core/**`). Anything language-specific
  belongs in an adapter.
- `libs/core`, `libs/engine` (outside `src/node/`), the forges,
  `libs/frameworks` and `apps/web` run in a browser (D22): no `node:` or Bun imports (Biome
  enforces it; tests may).
  Repository access goes through the async `Snapshot`; ask for reads
  together (`Promise.all`) where order doesn't matter, so API snapshots
  can batch them.
- Pin exact dependency versions (`bunfig.toml` `exact = true`).
- The web app deploys itself after green CI on main (`deploy.yml`, D24);
  everything about the host is a secret of the `production` environment,
  never in the repository (it is to be public). A new origin the app
  talks to needs the CSP in `apps/web/public/.htaccess`.
- Work on a branch and open a PR; merge only with CI green.
- The repository is public: nothing about private repositories (names,
  paths, code) or the hosting goes into it, nor into PR descriptions.
  Recordings of private repositories belong in `local/` (gitignored).

## Commands

```sh
bun install                          # also installs the lefthook hooks
bun ripple owner/repo#123            # run the CLI on a PR (GITHUB_TOKEN or `gh auth token`)
bunx nx run-many -t typecheck test:unit   # or: bunx nx affected -t …
bunx biome check --write .
bun ripple owner/repo#123 --record apps/cli/fixtures/<name>   # add a fixture
bun ripple owner/repo#123 --ai       # with the AI layer (sends the diff to Anthropic)
bun corpus [--ai] [<repo>-<n> …]     # evaluation corpus (local/corpus, gitignored)
bun dev                              # web app on http://localhost:4200 (ng serve; no server)
bunx nx run @ripple-review/web:shots    # screenshots and the cover into apps/web/shots/out
                                     # (GitHub faked from a fixture; once: cd apps/web && bunx playwright install chromium)
```

## Tests

Vitest, `*.test.ts` next to the code, run per project by `test:unit`
(`bun --bun vitest run src`). Every adapter runs the shared contract suite
(`@ripple-review/core/testing/adapter-contract`). Recorded PRs in
`apps/cli/fixtures/` (and `local/fixtures/`, when present) replay offline
against a golden `expected.md`: a change
to `libs/core` or an adapter that alters a review order fails there. If the
new order is intended, accept it with
`bunx nx run @ripple-review/cli:test:unit -- -u` and say why in the PR;
then bump `SAVED_REVIEWS` in `apps/web/src/engine/saved-reviews.ts` (its
test fails until you do), so the web app stops reusing reviews saved on
users' devices by the old engine.
