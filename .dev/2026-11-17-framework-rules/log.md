# Log

Newest first. One entry per session: machine, what happened, what's next.

## 2026-11-17: mac, planned; phase 01

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
- **Next:** the user reviews the PR; phase 02 (Angular moved).
