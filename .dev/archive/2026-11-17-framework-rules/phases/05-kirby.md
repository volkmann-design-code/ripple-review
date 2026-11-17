---
id: 05-kirby
title: "Kirby"
status: done
depends_on: [01-port-and-graphile-migrate]
branch: frameworks-05-kirby
pr: 24
updated: 2026-11-17
---

# 05 Kirby

D1, D2. In Kirby a file's name is its key: everything refers to a
blueprint, template, snippet or collection by the name of its file.

- [x] Detected by the layout: blueprints in a site (`site`, `…/site`) or a
      plugin (a folder with `index.php`). composer.json isn't read:
      recordings don't keep it.
- [x] A blueprint defines its id (`tabs/x`, `pages/x`; a page's also its
      template name `x`): plugins register and reuse blueprints by id, so
      PHP naming them links to them. Blueprints are schema.
- [x] A blueprint is made of what it extends or uses by id
      (`extends: sections/notes`, `cover: fields/cover`; a bare
      `extends: basefield` when only one kind has it), as parts.
- [x] A blueprint naming templates (`template: x`, `templates:`,
      `create:`) reads `pages/x.yml` / `files/x.yml` first; `fieldsets:`
      reads `blocks/x.yml` first; `snippets/blocks/x.php` comes after
      `blocks/x.yml`; PHP naming a template (`'template' => 'x'`,
      `->template('x')`, `template() == 'x'`) reads `pages/x.yml` first.
- [x] The textbook layout (getkirby/starterkit): `blueprints/pages/x.yml`
      before `models/x.php`, `controllers/x.php`, `templates/x.php`; the
      model before the controller, both before the template;
      `snippet('x')` reads `snippets/x.php` as a part, `collection('x')`
      reads `collections/x.php` first. Paths and names only, no PHP parser.
- [x] Corpus: the private Kirby PRs, "unlinked 100 %" → 70–75 %; no golden
      changed. `SAVED_REVIEWS.version` 6.
- [x] Public fixtures from getkirby/starterkit: `kirby-starterkit-14`
      (blueprints, fields part, collection, controller, snippets,
      templates), `-43` (section blueprints as parts), `-30` (snippets of
      many templates; closed, not merged).
- Not done: plugin extensions registered under other paths than the
  layout's; content files (`content/…/x.txt` is a page of template `x`).
