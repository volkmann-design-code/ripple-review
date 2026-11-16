---
id: 04-ai-layer
title: AI layer
status: done
depends_on: [03-evaluation-corpus]
branch: phase-04-ai-layer
pr: null
updated: 2026-11-16
---

# 04 AI layer

D2; D18 (provider-independent core, `libs/ai-anthropic` first, no
framework), D19 (`--ai` / `--no-ai`, off by default), D20 (Opus 5.5
medium on the summary input).

- [x] Input: the stories with their files, roles, edges with their names,
      stats, and trimmed hunks; output as structured JSON (story names
      and one-line purpose, files moved between stories, docs and config
      placed, edges flagged as weak).
- [x] The static order stays the default; the AI output is applied as a
      validated patch (unknown files ignored, every file still listed once).
- [x] `ReviewModel` port in `libs/core` (no dependency) with a fake for
      tests; `libs/ai-anthropic` on `@anthropic-ai/sdk` (structured
      outputs, default `claude-opus-5-5`).
- [x] Cached by diff hash; `--ai` / `--no-ai`, `--ai-model`; off by default
      (D19), so the CLI stays deterministic.
- [x] Corpus runs with AI: `bun corpus --ai` (all 28 PRs, ~1.40 USD; D20) writes the AI order next to the
      static one, so the user's notes can compare both.
- [x] Compare models and inputs (see below); pick the model by quality and
      cost per PR: `claude-opus-5-5`, effort medium, summary input (default).
- [x] Summary input with a `read_diff` tool instead of the whole diff.
## Left for later

- [ ] The user's notes on the `.ai.md` orders; suggested first: five
      corpus PRs where the AI moved most.
- [ ] Whether `--ai` becomes the default (D19), after those notes.
- [ ] Weak links are reported, not used: re-plan without them?
- [ ] From 03, for the AI or the static layer: docs placed next to the
      story they describe; related stories kept together; weak links
      (names mentioned only in comments; an import of a modified file whose
      diff touches neither the import nor the imported names).

## Notes

- Core (`libs/core/src/ai.ts`) owns the prompt, the JSON schema and the
  validation; a provider only sends the request (`ReviewModel.complete`).
  The answer names story/misc groups with a one-line purpose, orders all
  groups but context and generated, moves files (only out of context, story
  and misc, only into story and misc) and flags weak links (only edges the
  analysis found). Everything else is dropped and listed as "ignored".
- Cache: `~/.cache/ripple-review/ai/<sha256>.json`, keyed by model id
  (provider, model, effort), `PROMPT_VERSION` and the request (static order
  plus trimmed diff).
- `libs/ai-anthropic`: `@anthropic-ai/sdk` 1.6.0, streamed, structured
  output, effort `high` by default, server-side fallbacks opted in
  (`fallbacks: "default"`: a request a safety classifier declines is re-run
  on Anthropic's recommended fallback model; usage says when that happened).
- Smoke test on ripple-review#3 (56 files): 40k tokens in, 3.6k out, ~0.23
  USD with `claude-opus-5-5` at effort high. Weak links are reported, not yet
  used to re-plan.

### Model and input comparison (2026-11-16)

First on ripple-review#3 alone, full input: Opus 5.5 high/medium/low,
Sonnet 5.5 high/medium, Haiku 5.5 high/medium. Effort barely changes the
cost (input dominates: 40k tokens); Opus restructures (moves, weak links)
best, Sonnet names well but moves little, Haiku medium broke the rules
(config last, contradictory weak links).

Then three candidates x two inputs on five private PRs (7 to 118 files)
and ripple-review#3 (36 runs, ~2.6 USD):

| variant | avg USD/PR | input tokens 88 / 118 files | quality |
|---|--:|--:|---|
| Opus 5.5 medium, full | 0.23 | 56k / 78k | best: docs to their story, schema guards and wiring into the feature, i18n to the screen that uses it |
| Opus 5.5 medium, summary | 0.09 | 20k / 24k | as good as full; no rule violations |
| Sonnet 5.5 high, full | 0.12 | 56k / 78k | good names, fewer moves, several wrong-direction weak links |
| Sonnet 5.5 high, summary | 0.05 | 20k / 24k | good names; left templates as a group of their own on the 118-file PR |
| Haiku 5.5 high, full | 0.01 | 56k / 78k | decent names, many ignored entries |
| Haiku 5.5 high, summary | 0.006 | 20k / 24k | decent; the only one that used read_diff (2 of 6) |

- Summary input: Opus and Sonnet never called `read_diff`; the summary
  (names a diff touches, first changed lines, links) was enough for them.
  The tool stays, for PRs where it isn't.
- Prompt caching removed: one turn is the rule, and a cache write costs 25 %
  over plain input.
- Weak links are matched in either direction: with links listed as
  `b ← a`, models mixed up `from` and `to`.
- Seen in every variant: Angular templates (`*.component.html`) sit apart
  from their component in the static order; the AI moves them back. A
  static link (templateUrl) would fix it without AI (phase 05).

### Corpus run with AI (2026-11-16)

All 28 PRs, Opus 5.5 medium, summary input: ~1.40 USD for 23 new calls
(5 came from the comparison's cache), 2k-60k tokens in (a 393-file PR the
most, 0.32 USD). No answer had entries the rules dropped; no PR
needed `read_diff`. Moves and weak links mostly where the static order is
weak: Angular templates, i18n files, tests next to what they test, docs into
their story. Misc groups got a `section` (config, standalone, tests) so
measures still find them after the AI renames them.
