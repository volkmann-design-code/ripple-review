---
id: 03-graphile-worker
title: "graphile-worker"
status: done
depends_on: [01-port-and-graphile-migrate]
branch: frameworks-03-graphile-worker
pr: 22
updated: 2026-11-17
---

# 03 graphile-worker

D1, D2.

- [x] Detected by `graphile-worker` in a package.json (`packagesUsing` in
      `src/manifests.ts`, shared with Angular); a file under a `tasks/`
      folder of such a package (the root's covers all) defines its
      basename, if the basename looks like a task name (no dots: not
      `x.test`, `x.db-interaction`), isn't `index` and the file has a
      default export, as graphile-worker loads it.
- [x] Mentions (SQL `add_job` / a project's `enqueue_job`, `addJob`,
      crontab, tests) link through the existing name machinery: kebab
      names in changed lines, "(graphile-worker)" in the note.
- [x] Corpus: only the one PR that changes task files and their queuing
      moved, all for the better (groups 12 → 9, stories 8 → 5, unlinked
      10 % → 6 %); no golden changed. `SAVED_REVIEWS.version` 4 (output
      changes for such repositories).
- Not done: other spellings (`sendEmail`, `send_email` for `send-email`).
  No recording queues a task by them, and a camelCase spelling would link
  any function of that name. Repositories that queue through their own
  managers (no `tasks/` folder) get nothing; inferring those is a separate
  question.
