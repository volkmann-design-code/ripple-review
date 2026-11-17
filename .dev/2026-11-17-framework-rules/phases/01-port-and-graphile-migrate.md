---
id: 01-port-and-graphile-migrate
title: "Port, libs/frameworks, graphile-migrate"
status: review
depends_on: []
branch: frameworks-01-graphile-migrate
pr: null
updated: 2026-11-17
---

# 01 Port, `libs/frameworks`, graphile-migrate

D1, D3, D4.

- [x] `FrameworkRule` / `FrameworkFacts` in `libs/core/src/framework.ts`;
      `analyze(cs, adapters, frameworks, onStep)`: detect at setup next to
      adapter init, facts per changed file, role hints after the adapter's
      (`classify`'s `frameworkHint`).
- [x] `parts` → `contains` edges, `dependsOn` → `framework` edges (weight 1),
      rule definitions join the name links (hyphenated names of 6+ count);
      `Edge.framework` named in the reasons, except on "included by",
      which says it already.
- [x] `libs/frameworks` (Nx project, tsconfig path, browser-only Biome
      rule), `defaultFrameworks()` in `libs/engine/src/adapters.ts`.
- [x] graphile-migrate: detected by a `.gmrc*` path; its migrations folder
      is the one holding `committed/*.sql`, `current.sql` or `current/`
      (the `.gmrc` itself isn't read: recordings don't keep it);
      `--! include` and `--! Included` resolved against `fixtures/`. The
      SQL adapter keeps psql's `\i`, and its `migrations/` role hint.
- [x] Same corpus measures and golden orders as #19 (compared); #19's
      `SAVED_REVIEWS.version` 2 kept; close #19.
