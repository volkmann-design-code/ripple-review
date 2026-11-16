---
id: 05-more-adapters
title: More adapters (tree-sitter)
status: todo
depends_on: [02-tests-and-fixtures]
branch: null
pr: null
updated: 2026-11-16
---

# 05 More adapters

D3.

- [x] Angular (in the TypeScript adapter): `templateUrl` / `styleUrl(s)`
      as parts of the component (contains); selector, inputs and outputs
      as names, so a template binding them links to the component; core
      matches kebab-case mentions. With it, independent stories are ordered
      by role (schema first), then size. Corpus: standalone share 44 % → 0 %
      and 19 % → 10 % on two PRs, tests placed 72 → 100 % and 25 → 75 % on
      two others; the SQL story now precedes its UI on four PRs, and the
      88-file PR's feature precedes its refactors.
- [ ] A tree-sitter base for adapters (web-tree-sitter, grammars as WASM),
      so a language is a set of queries plus a resolver.
- [ ] Python (imports, `__init__.py` re-exports), Go (packages by
      directory, `go.mod` module path), then by demand: Java/Kotlin, C#, Rust.
- [ ] More schema kinds: Prisma, OpenAPI, Protobuf (definitions by name).
- [ ] Each adapter passes the shared contract suite (02) and has a small
      fixture repo.
