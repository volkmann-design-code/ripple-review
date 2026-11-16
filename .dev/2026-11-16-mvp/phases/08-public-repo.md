---
id: 08-public-repo
title: Public repository
status: in-progress
depends_on: [07-web-app]
branch: public-repo-prep
pr: null
updated: 2026-11-16
---

# 08 Public repository

D25 (changes D9).

- [x] `LICENSE.md`: FSL-1.1-MIT (the official template), licensor Enzo
      Volkmann; `license` in the root `package.json`; each fixture with its
      project's `LICENSE` (all MIT); a License section in the README.
- [x] Public fixtures instead of private ones: `hono-5556` (TypeScript),
      `umami-1376` (SQL migrations and their consumers), `spartan-1845`
      (Angular). The private ones and `ripple-review-3` in the gitignored
      `local/fixtures/`, which the golden tests run when present; the web
      tests on `hono-5556`; `SAVED_REVIEWS.goldens` over the committed
      fixtures only.
- [x] The corpus in the gitignored `local/corpus/` (`bun corpus`'
      default).
- [x] Hints of private repositories and of the hosting removed from code,
      docs and `.dev/`; `examples/spartan-1845.md` instead of the private
      example; CLAUDE.md says what never goes into the repository.
- [x] CI on GitHub-hosted runners, the same-repository gate dropped (fork
      PRs get CI, with a read-only token).
- [ ] Merge.
- [ ] The fresh public repository with one initial commit from the merged
      tree; the private one renamed and archived.
- [ ] The `production` environment's secrets recreated there (D24); the
      first deploy checked.
