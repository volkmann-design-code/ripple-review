# Log

Newest first. One entry per session: machine, what happened, what's next.

## 2026-11-17: mac, closed

- #20–#24 squash-merged into main in order (each next PR retargeted to
  main and main merged into it first, keeping its tree); branches
  deleted. Effort done and archived; what's left open is in `README.md`.

## 2026-11-17: mac, phase 05

- Kirby rule, stacked on #23. The private Kirby repository is a set of
  plugins that name their blueprints by id in PHP (`'tabs/x'`), with no
  page models or templates of the classic kind; the official starterkit
  shows the textbook layout (blueprint, model, controller, template of
  one name; snippets; collections). The rule covers both.
- Corpus: only the three Kirby PRs changed: unlinked 100 % → 75 %, 74 %,
  70 %; stories 0 → 3, 5, 1; standalone 49/61/70 % → 31/36/40 %. Notes
  read like "mentions `tabs/…` from ….yml (Kirby)". No golden changed;
  `SAVED_REVIEWS.version` 6.
- Public fixtures: starterkit PRs 14, 43 and 30 recorded as goldens
  (their orders checked by hand), so CI covers the rule; the goldens
  hash in `SAVED_REVIEWS` updated, the version stays 6.
- From review: Kirby's references are file names throughout, so the rule
  follows them all: `template(s):`/`create:` to page and file blueprints,
  `fieldsets:` and block snippets to block blueprints, bare `extends:`,
  templates named in PHP. starterkit-14's `files/image.yml` is no longer
  standalone; private corpus measures unchanged. Version stays 6 (not
  released yet), goldens hash updated.
- **Next:** the user reviews #20–#24 in order.

## 2026-11-17: mac, phase 04

- PostGraphile rule, stacked on #22: tables and views define their names
  by both inflections, functions and computed columns their camelCase
  field, `@name` smart comments the renamed names; `*_hidden` /
  `*_private` schemas skipped. Respellings of 3+ words left to generic
  matching (otherwise a note lists the same name twice).
- Corpus measures byte-identical; the measures are too coarse to see it,
  so outputs were compared with and without the rule on the 13 recordings
  changing SQL: one PR gains 10 links (web queries and mutations to the
  migration creating their tables), the rest unchanged. Both private
  repositories use PostGraphile, one with the simplify inflector.
- **Next:** the user reviews #20–#23; then phase 05
  (Kirby).

## 2026-11-17: mac, phase 03

- graphile-worker rule, stacked on #21: task files under a `tasks/` folder
  of a package depending on it define their basename (task-like names,
  default export, not `index`). `packagesUsing` shared with Angular.
- Corpus: only the one private PR changing task files and their queuing
  changed: groups 12 → 9, stories 8 → 5, standalone 7 % → 4 %,
  testsPlaced 88 % → 92 %, unlinked 10 % → 6 %. No golden changed;
  `SAVED_REVIEWS.version` 4.
- Found: another private repository queues through its own queue
  managers, no `tasks/` folder: nothing to infer from layout there.
- **Next:** phase 04 (PostGraphile).

## 2026-11-17: mac, planned; phases 01–02

- From the mvp effort's corpus: the user wants framework rules, first
  graphile-migrate, Angular (moved), graphile-worker, PostGraphile, Kirby,
  inferred from layout (D1–D4). Phase 01 started on top of #19's commit.
- Phase 01 done: the port, `libs/frameworks`, graphile-migrate's includes
  moved out of the SQL adapter. Corpus measures and every golden order
  (public and `local/fixtures`) identical to #19's; the web app builds.
  "(graphile-migrate)" after every "included by" was noise, so contains
  notes don't name the framework.
- Found: the private fixtures and the corpus record only the files read,
  so rules detect from paths (`.gmrc`) and from `package.json`, never from
  files nothing read before.
- Review of #20: the lib will grow, so a folder per rule (`src/<id>/`),
  pushed to #20 (D3 updated).
- Phase 02: Angular moved into `libs/frameworks/src/angular/`, stacked on
  #20. Corpus measures byte-identical; every review order identical
  (public and private); name notes from bindings now end in "(Angular)"
  (spartan-1845, one private golden), so `SAVED_REVIEWS.version` 3.
- **Next:** the user reviews #20 and phase 02's PR; then phase 03
  (graphile-worker).
