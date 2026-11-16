---
id: 03-evaluation-corpus
title: "Evaluation corpus: 20–30 real PRs"
status: done
depends_on: [02-tests-and-fixtures]
branch: phase-03-evaluation-corpus
pr: 5
updated: 2026-11-16
---

# 03 Evaluation corpus

Does the order feel right? D1, D2; set up by D14–D17.

- [x] Corpus tooling (`bun corpus`, `apps/cli/src/corpus.ts`): `corpus.json` lists the PRs (repo,
      number, shape, why chosen). A script records each missing one into
      `~/.cache/ripple-review/corpus/` (D14), runs the review, writes
      `<repo>-<n>.md` (the order, then a "Notes" section kept
      across runs for the user's text, D15) and a summary table of the
      measures (D15) in `README.md`, all in the corpus folder
      (`.dev/…/data/corpus/` at first, the gitignored `local/corpus/`
      since D25).
- [x] Propose 20–30 merged PRs (D16) across three private
      repositories (D17), most from the largest, by shape: DB-heavy,
      frontend-only, refactors, mixed stories, small (< 10 files), large
      (> 80 files). The user strikes or swaps. Proposed: 28,
      all accepted.
- [x] The user writes notes per PR (D15); turn them into findings, grouped
      by pattern. Notes on 6 PRs so far; the rest stays open for later rounds,
      `bun corpus` keeps working on the same files.
- [x] Fix the static layer where the notes show a pattern; what stays is
      input for 04, what needs an adapter for 05. Re-run and compare the
      measures before and after each fix.
- [x] An inline value replaced by a shared constant reads as one
      mechanical edit (constant folding, the user's idea).
- [x] Config before the code it sets up; config
      follows the mechanical edits in its directory.
- [x] Megabyte files are generated; string keys of
      enums and constants link to where SQL and specs use them; story
      cycles at equal weight go schema first.
- [x] Generator configs name their outputs (graphql-codegen, Prisma, buf,
      sqlc, Orval, openapi-generator, kysely-codegen, PostGraphile).
- [x] snake_case ↔ camelCase name links for names of 3+ words.
- [x] From dogfooding on ripple-review#3: identical new files as one
      mechanical group; new tests of unchanged code grouped per project
      ("Tests in `libs/core`", after "Standalone changes"); config along
      its directory's stories and mechanical edits (above).
- [x] Promoted to fixtures: three private PRs (constant folding; DB and
      web with cross-spelling links; small, with tests per project), in
      `local/fixtures/` since D25.
- Moved to 04: story order separating related stories, docs next to the
      story they describe, name links from comments, and counting an import
      edge of a modified file only if its diff touches the import or the
      imported names (needs to know which declaration a changed line is in).
