# Log

Newest first. One entry per session: machine, what happened, what's next.

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
- **Next:** the user reviews #20, #21, phase 03's PR; then phase 04
  (PostGraphile).

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
