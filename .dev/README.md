# .dev: multi-session efforts

Working notes for efforts that span several sessions, machines or agents: the
plan, where it stands, and the data it rests on. Committed, so every machine
and every agent reads the same state. Not product documentation, and not a
replacement for PR descriptions or code comments. Anything that stays true
once the effort ends moves into the code, a `CLAUDE.md` or the `README.md`.

## Layout

```
.dev/
  <YYYY-MM-DD>-<slug>/        one effort, dated by its start
    README.md                 entry point: goal, status, phase table, how to resume
    decisions.md              decisions taken, with the reason; append, never rewrite
    log.md                    one entry per session, newest first
    phases/
      <NN>-<slug>.md          one phase = roughly one PR; frontmatter tracks it
    data/                     measurements, evaluation runs, reference files
  archive/
    <YYYY-MM-DD>-<slug>/      a closed effort, moved here unchanged
```

## Frontmatter

Effort `README.md`:

```yaml
---
effort: mvp
status: active            # planned | active | paused | done | abandoned
started: 2026-11-16
updated: 2026-11-16
owner: Enzo Volkmann
phases: [00-cli-prototype, 01-tooling-and-ci, ...]
---
```

Phase file:

```yaml
---
id: 01-tooling-and-ci
title: Nx workspace, lefthook, Biome, CI
status: todo              # todo | in-progress | blocked | review | done | dropped
depends_on: [00-cli-prototype]
branch: null              # once started
pr: null                  # PR number once opened
updated: 2026-11-16
---
```

## Working on an effort

1. Read the effort's `README.md`, then `log.md`'s latest entry, then the phase
   you are picking up. Read `decisions.md` entries as needed; one with a
   "Changed by" line no longer holds as written.
2. Before starting a phase, set `status: in-progress`, `branch` and `updated`.
3. Tick the phase's task list as you go. When a task turns out different from
   the plan, change the task; a new decision goes in `decisions.md`, and one
   that changes an earlier decision says so (`**Changes:** D3 (what)`).
4. End every session with a `log.md` entry and an updated `updated:`.

## Closing an effort

`status: done` (or `abandoned`), move what stays true into the code or docs,
list what was left open in the effort's `README.md`, then
`git mv .dev/<effort> .dev/archive/<effort>`.
