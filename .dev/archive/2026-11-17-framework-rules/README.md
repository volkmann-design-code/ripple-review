---
effort: framework-rules
status: done
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

## Outcome

Done 2026-11-17: #20–#24, squash-merged into main in order.

- `libs/frameworks`, one folder per rule, `FrameworkRule` in core; edges
  of kind `framework`, notes ending in "(Rule)".
- graphile-migrate: includes (`--! include`, committed `--! Included`).
- Angular: moved out of the TypeScript adapter, same orders.
- graphile-worker: task files named by their basename.
- PostGraphile: GraphQL names by both inflections, functions, computed
  columns, `@name`.
- Kirby: a file's name is its key; blueprint ids, `extends`, templates,
  blocks, page code in reading order, snippets, collections. Public
  fixtures `kirby-starterkit-14`, `-30`, `-43`.
- Corpus: the PRs with no link at all went down (Kirby's from "unlinked
  100 %" to 70–75 %); `SAVED_REVIEWS.version` 6.

What stays true lives in `README.md` ("Adding a framework", the list of
rules) and `CLAUDE.md`.

## Left open

- graphile-worker: other spellings of a task name; repositories queueing
  through their own managers (no `tasks/` folder).
- PostGraphile: smart tags given in code, relation fields (`…By<Fk>`),
  irregular plurals.
- Kirby: plugin extensions registered outside the layout's folders;
  content files (`content/…/x.txt` is a page of template `x`).
- Ideas from the AI layer, worth a static version: filter comment-only
  changes, add import edges only where the diff touches the import, place
  docs next to the story they describe.

## Phases

| #  | Phase | Status |
|----|-------|--------|
| 01 | [Port, `libs/frameworks`, graphile-migrate](phases/01-port-and-graphile-migrate.md) | done |
| 02 | [Angular moved out of the TypeScript adapter](phases/02-angular.md) | done |
| 03 | [graphile-worker](phases/03-graphile-worker.md) | done |
| 04 | [PostGraphile](phases/04-postgraphile.md) | done |
| 05 | [Kirby](phases/05-kirby.md) | done |

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

Closed. A new framework starts from "Adding a framework" in the root
`README.md`; follow-ups from "Left open" become a new effort.
