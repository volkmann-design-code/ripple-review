---
id: 05-kirby
title: "Kirby"
status: review
depends_on: [01-port-and-graphile-migrate]
branch: frameworks-05-kirby
pr: 24
updated: 2026-11-17
---

# 05 Kirby

D1, D2.

- [x] Detected by the layout: blueprints in a site (`site`, `…/site`) or a
      plugin (a folder with `index.php`). composer.json isn't read:
      recordings don't keep it.
- [x] A blueprint defines its id (`tabs/x`, `pages/x`; a page's also its
      template name `x`): plugins register and reuse blueprints by id, so
      PHP naming them links to them. Blueprints are schema.
- [x] A blueprint is made of what it extends or uses by id
      (`extends: sections/notes`, `cover: fields/cover`), as parts.
- [x] The textbook layout (getkirby/starterkit): `blueprints/pages/x.yml`
      before `models/x.php`, `controllers/x.php`, `templates/x.php`; the
      model before the controller, both before the template;
      `snippet('x')` reads `snippets/x.php` as a part, `collection('x')`
      reads `collections/x.php` first. Paths and names only, no PHP parser.
- [x] Corpus: the private Kirby PRs, "unlinked 100 %" → 70–75 %; no golden
      changed. `SAVED_REVIEWS.version` 6.
- Not done: a public fixture (the starterkit's PRs mostly update the
  vendored core); blocks (`snippets/blocks/x.php` for block type `x`),
  `template: x` in sections, plugin extensions registered under other
  paths.
