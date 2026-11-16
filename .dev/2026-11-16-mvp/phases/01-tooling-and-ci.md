---
id: 01-tooling-and-ci
title: Nx workspace, lefthook, Biome, CI
status: done
depends_on: [00-cli-prototype]
branch: phase-01-tooling-and-ci
pr: 2
updated: 2026-11-16
---

# 01 Tooling and CI

D7, D8, D9; O1, O2. Copy the setup from the user's other projects rather
than inventing one: `nx.json`, `biome.json`, `lefthook.yml`, `.github/workflows/ci.yml`,
`scripts/check-bun-version.ts`.

- [x] Rename: package `ripple-review`, binary `ripple` (D10), cache dir
      `~/.cache/ripple-review`.
- [x] Bun pinned via `packageManager` (same version as the user's other projects), workspaces,
      `bunfig.toml` copied (exact pins, minimum release age).
- [x] Nx workspace, `targetDefaults` with cache for `typecheck`, `test:unit`,
      `build`; `affected.defaultBase: main`. Proposed projects:
      - `apps/cli`: argument parsing, wiring
      - `libs/core`: model, diff, graph, classify, mechanical, community,
        topo, order
      - `libs/sources`: GitHub, local git
      - `libs/adapter-typescript`, `libs/adapter-sql`, `libs/adapter-graphql`
      - `libs/report`: Markdown, JSON
      Adapters depend on `libs/core`'s model only, never the other way round.
      Done as proposed, with `defaultAdapters()` in `apps/cli/src/adapters.ts`
      and `paths.ts` in core (D11). Nx can't read Bun 1.4's v2 `bun.lock`,
      so `analyzeLockfile: false` (D11).
- [x] Biome pinned in `package.json`, `biome.json` as in the other projects
      (recommended preset, `useBlockStatements`), whole codebase formatted.
      Plus `noRestrictedImports` keeping `libs/core` free of workspace
      imports. 89 `noNonNullAssertion` warnings left as warnings; Biome's unsafe fix turns `x!.y` into `x?.y`, which
      changes types, so it is not applied wholesale.
- [x] lefthook: pre-commit `biome check --write` on staged files, plus
      `scripts/check-biome-schema.ts`.
      `scripts/check-bun-version.ts` skipped: it checks Dockerfiles, and
      there are none yet.
- [x] `.github/workflows/ci.yml` (D9; first on self-hosted runners, every
      job gated to same-repo events, GitHub-hosted since D25), `concurrency` with
      cancel-in-progress, `NX_DEFAULT_OUTPUT_STYLE: stream`; jobs: Biome
      (pinned binary, no install), `nx affected -t typecheck`,
      `nx affected -t test:unit`. Done as two jobs, `biome` and
      `typecheck-and-test` (one install for both nx targets); no fast-fail
      cancel (it would need a `cancel-run.yml`, not worth it at two jobs).
- [x] ~~Branch protection on `main` with the CI checks required~~: not
      available for a private repo on GitHub Free (403 "Upgrade to GitHub
      Pro or make this repository public"; rulesets too). By convention instead: work on
      branches and PRs, merge only with CI green (`CLAUDE.md`).
- [x] A `CLAUDE.md` for the repo: stack, commands, the adapter rule, `.dev/`.
