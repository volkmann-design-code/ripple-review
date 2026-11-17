---
id: 02-angular
title: "Angular moved out of the TypeScript adapter"
status: todo
depends_on: [01-port-and-graphile-migrate]
branch: null
pr: null
updated: 2026-11-17
---

# 02 Angular moved out of the TypeScript adapter

D1.

- [ ] `angularDeclarations`, `selectorNames`, `bindingName` move to
      `libs/frameworks/src/angular.ts`; detected by `@angular/core`.
- [ ] `templateUrl` / `styleUrl(s)` as `parts`, selector, inputs and
      outputs as definitions.
- [ ] Every golden identical (public and `local/fixtures`): a pure move.
