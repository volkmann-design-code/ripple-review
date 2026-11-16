---
id: 06-github-app
title: "GitHub App: sticky PR comment"
status: todo
depends_on: [03-evaluation-corpus]
branch: null
pr: null
updated: 2026-11-16
---

# 06 GitHub App

D4; O4.

- [ ] A GitHub Action variant first: runs the CLI in the PR's own CI and
      posts or updates one comment (no hosting); dogfood on the user's
      projects and on this repo.
- [ ] GitHub App: webhook on `pull_request` opened/synchronize/reopened,
      installation token for contents and the comment, the clone cache
      per installation.
- [ ] Comment: groups as collapsible sections, a checklist with links to
      the files' anchors, generated files collapsed; updated in place on
      every push.
- [ ] Limits: diffs `gh pr diff` refuses (too large) fetched as two
      revisions and diffed locally.
