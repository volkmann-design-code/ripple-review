---
id: 02-tests-and-fixtures
title: Tests and recorded fixtures
status: done
depends_on: [01-tooling-and-ci]
branch: phase-02-tests-and-fixtures
pr: 3
updated: 2026-11-16
---

# 02 Tests and recorded fixtures

O2 (answered by D12), D13.

- [x] Vitest set up (D12): `vitest.shared.ts`, a
      `vitest.config.ts` and a `test:unit` script per project, run by
      `nx affected -t typecheck test:unit` in CI.
- [x] Unit tests: diff parser (renames, deletions, `--- ` inside hunks,
      no-newline markers, binary, stripped context lines), `topoOrder`
      (cycles, ties, newly ready nodes), Louvain (determinism, node-order
      independence), mechanical groups (literal and whitespace
      normalization, size and share limits), `.gitattributes` globs, roles,
      `analyze` with a toy adapter (barrel following, name links, generated
      files not defining names), TS resolution (paths with `*`, nested
      tsconfig, `exports` conditions, wildcards and arrays, `main`, `.js` →
      `.ts`, directory index), SQL and GraphQL facts, Markdown report, PR
      refs, local git source on a throwaway repository.
      Found a bug: a conditional `exports` entry whose first condition
      (`types`) points to a file that isn't in the repository resolved to
      nothing; now every target is tried in order. The 88-file PR's order
      is unchanged by the fix.
- [x] Adapter contract tests: `libs/core/src/testing/adapter-contract.ts`,
      run by the TS, SQL and GraphQL adapters.
- [x] Recorded fixtures (D13): `ripple … --record <dir>` and
      `ripple --fixture <dir>`; the private 88-file PR recorded as a fixture
      (1.9 MB; in `local/fixtures/` since D25). Replay output is
      byte-identical to the live run.
- [x] Golden output: `expected.md` per fixture, compared with Vitest's
      `toMatchFileSnapshot`; accept a change with
      `bunx nx run @ripple-review/cli:test:unit -- -u`. Also checked per
      fixture: every changed file placed once, output deterministic.
