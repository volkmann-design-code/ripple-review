---
id: 02-angular
title: "Angular moved out of the TypeScript adapter"
status: done
depends_on: [01-port-and-graphile-migrate]
branch: frameworks-02-angular
pr: 21
updated: 2026-11-17
---

# 02 Angular moved out of the TypeScript adapter

D1, D3.

- [x] `angularDeclarations` (now `declarations`), `selectorNames` and
      `bindingName` moved to `libs/frameworks/src/angular/`; detected by
      `@angular/core` in any `package.json` (the TypeScript adapter reads
      them all, so recordings keep them).
- [x] `templateUrl` / `styleUrl(s)` as `parts` (existing paths only),
      selector, inputs and outputs as definitions.
- [x] Every review order identical (public and `local/fixtures`), corpus
      measures byte-identical. The one change: name notes from Angular
      bindings end in "(Angular)", like every rule's (spartan-1845 and one
      private golden); `SAVED_REVIEWS.version` 3.
- Side effect, no golden or corpus change: as rule definitions, hyphenated
  selectors of 6–11 characters (`app-card`) now count as names; before
  they needed 12.
