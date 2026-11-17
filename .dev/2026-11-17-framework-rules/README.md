---
effort: framework-rules
status: active
started: 2026-11-17
updated: 2026-11-17
owner: Enzo Volkmann
phases:
  - 01-port-and-graphile-migrate
  - 02-angular
  - 03-graphile-worker
  - 04-postgraphile
  - 05-kirby
---

# Framework rules

## Goal

Frameworks always follow the same patterns: a task file is queued by its
name, a Kirby blueprint has a model and a template of the same name, a
graphile-migrate migration inlines its fixtures. A rule per framework adds
the links that imports and generic name matching miss, so the static order
(without `--ai`) holds together on code that is mostly convention. Rules sit
next to the language adapters, detect their framework themselves (D1), infer
from layout rather than a config in the reviewed repository (D2), and live
in one lib, `libs/frameworks` (D3).

Started from the corpus (mvp effort, phase 03): 8 of 28 PRs had no edge at
all; graphile-migrate's committed includes were missed (PR #19, replaced by
phase 01, D4), Kirby's three PRs have no links, a private repository's worker tasks
link to nothing that queues them.

## Today

- `01` in review: `FrameworkRule` in core, `libs/frameworks` with the
  graphile-migrate rule (includes, also the committed `--! Included`
  form); output identical to #19's, which it replaces. A folder per rule
  (D3, from its review).
- `02` in review, stacked on 01: Angular moved into its rule; same orders,
  notes say "(Angular)".
- `03` in review (#22), stacked on 02: graphile-worker task files are named by
  their basename, so what queues them links to them.

## Phases

| #  | Phase | Status |
|----|-------|--------|
| 01 | [Port, `libs/frameworks`, graphile-migrate](phases/01-port-and-graphile-migrate.md) | review |
| 02 | [Angular moved out of the TypeScript adapter](phases/02-angular.md) | review |
| 03 | [graphile-worker](phases/03-graphile-worker.md) | review |
| 04 | [PostGraphile](phases/04-postgraphile.md) | todo |
| 05 | [Kirby](phases/05-kirby.md) | todo |

## Every phase

- Unit tests per rule (`MemorySnapshot`).
- Corpus measures before and after: copy `local/corpus/measures.json`
  aside, `bun corpus`, compare (the comparison goes in `log.md`).
- Golden changes judged; `SAVED_REVIEWS.version` bumped when output changes.
- A public PR as a fixture where one fits, so CI covers the rule.
- Rules detect from paths and from files the analysis reads anyway
  (`package.json`): recordings keep only the files read, so a rule that
  reads something new sees nothing in older fixtures and corpus recordings.

## Resuming

Read this file, `log.md`'s latest entry, then the phase in progress. In a
worktree, `ln -s ../../../local local` (never committed) makes the private
fixtures and the corpus available.
