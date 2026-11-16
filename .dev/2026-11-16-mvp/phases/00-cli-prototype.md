---
id: 00-cli-prototype
title: CLI prototype
status: done
depends_on: []
branch: main
pr: null
updated: 2026-11-16
---

# 00 CLI prototype

D2–D6. Commit `39ba603`.

- [x] Sources: GitHub PR (`gh pr view/diff`, head fetched `--depth=1` into a
      bare cache repo, read via `git cat-file --batch`, no checkout); local
      `--repo --base --head` (diff from the merge base).
- [x] Unified diff parser (hunks, renames, deletions, binaries).
- [x] Adapters: TypeScript/JS (TS compiler API; tsconfig `paths`, workspace
      `package.json` `exports`, relative; dynamic import/require), SQL
      (`create …`, `add column`, `--! include`, `\i`), GraphQL (types,
      `#import`).
- [x] Core: symbols followed through barrels to their defining file; name
      links; roles; mechanical groups; Louvain stories; topological order;
      reasons per file.
- [x] Report: Markdown checklist with PR file links; JSON.
- [x] Run on a private 88-file PR and a local range.
