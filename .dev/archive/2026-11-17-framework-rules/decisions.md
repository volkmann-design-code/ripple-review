# Decisions

## D1: Framework rules beside the adapters (2026-11-17)

A `FrameworkRule` (port in `libs/core/src/framework.ts`) detects its
framework in the repository and adds facts per changed file: names others
mention, parts it contains, files to read before it. Adapters stay about a
language; what a framework does on top goes in a rule. **Why:** framework
knowledge was scattered (Angular in the TypeScript adapter, graphile-migrate
in the SQL adapter) and new ones (Kirby: YAML and PHP) cross languages.

## D2: Inferred from layout, no configuration (2026-11-17)

Rules recognise conventions from paths and names (a file under a worker's
`tasks/` defines its basename as a task name) instead of reading a config
file in the reviewed repository. The user's choice. **Why:** catches
project-specific wrappers (`defineTask("x")`, an SQL `enqueue_job`) with no
setup and no public format to keep stable; some false links accepted.

## D3: One lib, `libs/frameworks` (2026-11-17)

One folder per rule (`src/<id>/`: the rule, its tests, its helpers) in one
project, registered in `libs/engine/src/adapters.ts`. Depends on core (and
`typescript` for Angular); runs in the browser. **Why:** rules are small; a
project each is overhead (package.json, tsconfig, Vitest config, tsconfig
path and Biome group per rule). The folders came from the review of #20, as
the lib grows with every rule. A rule becomes its own project only if it
brings a heavy dependency of its own.

## D4: graphile-migrate replaces PR #19 (2026-11-17)

The `--! Included` fix (#19) moves into the graphile-migrate rule with the
rest of its includes; #19 is closed. The user's choice.
