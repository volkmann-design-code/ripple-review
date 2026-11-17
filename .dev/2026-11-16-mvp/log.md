# Log

Newest first. One entry per session: machine, what happened, what's next.

## 2026-11-17: mac, static layer: weak communities merge back

- A new corpus PR (a migration including seven functions) split two of
  the included functions into a story of their own: they name each other,
  and Louvain splits such a pair off a star although each is tied twice as
  much to the hub.
- `mergeSingletons` became `mergeWeak` (`libs/core/src/community.ts`): a
  community whose internal ties, counted from both ends, don't outweigh
  its ties outside (Radicchi's weak community) joins its strongest
  neighbour. Corpus: three PRs change, each with fewer stories, all read
  better. Goldens: `hono-5556`, `kirby-starterkit-14`, `-30` (included
  snippets and blueprints now sit with what includes them); one private
  golden got worse: a 3-file story leaning on a core type everyone imports
  merged into that type's story.
- Hence hub damping (`order.ts`): an import, name or via-generated edge
  out of a file with n > 3 dependents counts 3/n; containment and
  framework edges keep their weight (a migration's includes say where a
  file belongs). Tried 1/log2 n and 1/sqrt(n/2) too: same fix, more
  churn. The private golden is back to its two stories; corpus: 8 PRs
  reorder, the moves put a file with its real user rather than with the
  shared type (one story more on one PR); two private goldens change the
  same way. `SAVED_REVIEWS.version` 7.
- **Next:** the user's review of the moved orders.

## 2026-11-17: mac, static layer: graphile-migrate's committed includes

- Asked what's next and how to improve the non-AI part. Corpus: 8 of 28
  PRs with no edge at all. Causes: the SQL adapter missed graphile-migrate's
  expanded `--! Included x.sql` in committed migrations (9 PRs have one);
  PHP (three PRs) and Dart (one) have no adapter.
- Fixed the includes. Corpus: unlinked 100 % → 1 %, 7 %, 17 % on the three
  SQL PRs without an edge; standalone 29 % → 12 % and 13 % → 7 % on two
  more. One private golden changed: the included files now read "included
  by", and Louvain moved one page component into its neighbouring story.
  `SAVED_REVIEWS.version` 2.
- With the user, for later: framework rules (patterns a framework always
  follows, like the Angular and graphile-migrate ones); the static parts of
  what went to 04 (no name links from comments, import edges only when the
  diff touches them, docs next to their story).
- **Next:** the user's call between those and the PHP/Dart adapters.

## 2026-11-16: mac, after publishing

- Phase 08 ticked on `main` directly (`[skip ci]`); Renovate configured
  (#1): pinned versions, 7-day release age, Angular and Nx grouped, no
  schedule (GitHub-hosted runners).
- The web app's footer: it runs in the browser, the source on GitHub, the
  license.
- Screenshots like the user's other demos: `bunx nx run
  @ripple-review/web:shots` (Playwright) takes the production build with
  GitHub's API faked from the `spartan-1845` fixture (`shots/fake-github.ts`,
  REST and GraphQL as `forge-github` calls them; the worker's requests are
  routed too): a review in light and dark, a thread next to its line, the
  start page, and a 1280×640 cover for the social preview. Output in
  `apps/web/shots/out/`, not committed.
- **Next:** the user sets the social preview; GitLab.

## 2026-11-16: mac, preparing the public repository

- The user chose to publish rather than keep the code private, under the
  Functional Source License (FSL-1.1-MIT, licensor Enzo Volkmann), and a
  fresh public repository from a cleaned tree, this one renamed and
  archived (D25). Private fixtures and the corpus stay on the user's
  machine in the gitignored `local/`.
- Found on the way: the corpus also held five PRs of a client's
  repository, so the whole corpus goes to `local/corpus/`, not only the
  fixtures.
- Three small public fixtures recorded (`hono-5556`, `umami-1376`,
  `spartan-1845`); the private ones (and `ripple-review-3`, whose recorded
  files contain one) moved to `local/fixtures/`, which the golden tests run
  when present; the web tests use `hono-5556`; `SAVED_REVIEWS.goldens`
  updated, the version kept (the engine's output is the same). `bun corpus`
  defaults to `local/corpus`. Hints of private repositories and of the
  hosting removed from code, docs and `.dev/` (phase 08). `LICENSE.md`
  from the official template; the fixtures keep their projects' licenses.
  CI on GitHub-hosted runners.
- Merged (#19), then the switch: the private repository renamed and
  archived, this one created with one initial commit, `production`
  secrets recreated (limited to `main`), CI and deploy green, then made
  public; `main` protected. Work continues in a fresh clone.
- **Next:** Renovate config; GitLab.

## 2026-11-16: mac, deploy

- The user created the site and asked for a deploy over SSH, and for the
  repository to become public later:
  no secrets or hints of the hosting or of private repositories in it.
- Audit for going public: the fixtures and the corpus hold private
  repositories' code and paths, and so do the history and several PR
  descriptions. The user's choice: a fresh public repository from a
  cleaned tree (this one archived), the private fixtures replaced by a few
  public PRs, `.dev/` published after cleanup; the deploy first.
- Deploy (D24): `deploy.yml`, `.htaccess`, `production` environment with
  secrets only. Tried from the Mac against the site (see phase 07); the
  site now runs this branch's build.
- **Next:** merge, watch the first deploy from Actions; then the public
  repository: replace fixtures and corpus, remove the hints, CI on
  GitHub-hosted runners, fresh history.

## 2026-11-16: mac, web app cleanup

- Merged #12–#15 (squash, in order; retarget the next PR to `main` before
  deleting a merged base branch, or GitHub closes it).
- The user's cleanup list before the deploy: no recorded fixtures in the
  web app; files under each group in the outline, with a scroll spy;
  "Recently viewed" on the start page; per-record deletion in Settings.
  All four done; checked in headless Chrome on #15 (outline while
  scrolling, jumping to a file, the home list, deleting #14's data).
- Found on the way: the web app's tests are not typechecked (`typecheck`
  runs `ngc` on `main.ts` and `tsc` on the worker); `notes.test.ts` has
  type errors since #15.
- **Next:** the user tries it; step 5, static deploy.

## 2026-11-16: mac, reviews on GitHub

- The user put writing and submitting GitHub reviews first, with the
  forge's capability checked; chose drafts in GitHub's pending review and
  a first version that writes and shows existing threads (D23).
- Probed the GraphQL API on #14 with pending drafts only (deleted after):
  `addPullRequestReviewThread` takes the pull request's ID and starts the
  pending review; a line outside the diff gives `thread: null` without an
  error; a pending review takes no body before submitting.
- `ForgeReviews` on `Forge`, `GitHubReviews`, the engine's `Drafts`
  (pending operations in IndexedDB `drafts`, version 3), the page's
  `DraftsStore`, comment forms on diff lines, threads and drafts in the
  diff, the review panel. Checked in headless Chrome on #14.
- **Next:** the user tries it (submitting on a real PR is theirs to do);
  merging #12 → #15 in order; step 5, static deploy.

## 2026-11-16: mac, progress and saved reviews

- The user tried step 4 (works) and asked for progress during "Analysing
  67 files", other messages when cached, and a note that results are
  saved on the device. Measured on #12 and the 88-file private PR: setup 1–2 s,
  changed files 1.5 s, following imports 1–7 s (GitHub round trips),
  linking and ordering < 0.1 s. `analyze` and `review` report steps;
  reviews are saved in IndexedDB and reused while the diff is the same.
- **Next:** the user's review of #13 and this PR; step 5, static deploy.

## 2026-11-16: mac, browser-only step 4 ("Viewed" synced with GitHub)

- `ViewedMarks` capability on `Forge`; `GitHubForge.viewed` over GraphQL.
  `Reviews` shows GitHub's marks as ticks and sets them on every tick;
  refused or failed marks stay pending in IndexedDB and are retried on
  the next load. The page shows whether ticks are synced, and why not.
- Checked: unit tests with a fake forge (refused, unreachable, out-of-order
  saves) and a fake GitHub (paging, aliased mutations, FORBIDDEN, paths not
  in the PR); live on #12 in both directions (marks reset afterwards);
  the page in headless Chrome. Not checked live: a fine-grained token
  without write access (GitHub's FORBIDDEN error is matched by type and
  wording).
- Ticks kept locally before this step aren't sent to GitHub: GitHub's
  marks win on the first load.
- **Next:** step 5, static deploy.

## 2026-11-16: mac, browser-only step 3 (engine in a Web Worker)

- `apps/server` removed. The engine runs in a Web Worker in the web app
  (`Backend`, ported from the server's `Reviews`, with async stores);
  the page calls it through `EngineService`. Settings page for the GitHub
  token and the Anthropic key; IndexedDB for ticks, the AI choice, AI
  answers and file contents by blob SHA. `Store` moved to core;
  `anthropicModel` takes an `apiKey` (browser client).
- Checked: GitHub's and Anthropic's APIs accept browser requests (CORS
  preflights with our headers); the backend in Bun against the dev
  server's fixtures and live on the 88-file PR: the same order as the CLI's
  pipeline, 12 s cold, 2 s with the blob cache in a new session.
  Production build: 81 kB initial transfer, the engine a lazy chunk.
  In headless Chrome (driven over the DevTools protocol): a fixture's
  review, the "no token" error with its Settings link, the 88-file PR live (again
  within 5 s after a browser restart, from IndexedDB), a tick kept across
  a restart.
- **Next:** the user tries it (`bun dev`, token under Settings); step 4,
  "Viewed" synced with GitHub.

## 2026-11-16: mac, browser-only hosting (D22), async snapshot

- With the user: hosted means no server and no storage of ours; the users'
  own credentials; data in the browser or with the forge; forges as
  adapters with capabilities (GitHub first, GitLab and self-hosted later);
  edge cases (large repos, rate limits) ignored for now (D22). Phase 07's
  hosted part rewritten as six steps.
- Step 1: `Snapshot` async, adapters init async with the path set, path
  helpers without `node:path`, a `Store` port for AI answers (FileStore
  under `libs/engine/src/node/`), Web Crypto hashes; Biome keeps `node:`
  out of core and engine. Golden orders unchanged; the 88-file PR live gives the
  same output in the same time.
- Step 2: `Forge` port and `libs/forge-github`; CLI, corpus and server
  read GitHub through its API (token from `gh auth token`). Reading over
  an API needed batching: a first version took 51 s on the 88-file PR (~35 rounds
  of GraphQL reads); breadth-first barrel trees (6 rounds) and a pool of
  20 small queries bring it to ~10 s. Same orders.
- **Next:** step 3, the engine in the browser (Web Worker), settings for
  tokens, IndexedDB stores, `apps/server` removed.

## 2026-11-16: mac, web app v1 (phase 07)

- With the user: our own web app before the GitHub Action, in Angular,
  local first and hostable later (D21); phase 07 rewritten and moved
  before 06.
- `libs/engine` (pipeline out of `apps/cli`), `libs/api-contract`,
  `apps/server` (Hono), `apps/web` (Angular 22, Tailwind 4). TypeScript
  6.0.3 for the workspace. `bun dev` and `bun serve`.
- Checked: server tests on the fixtures, the API through the dev proxy, the
  built app on one port. Not checked: the UI in a browser (no browser in
  this session); the user tries it.
- **Next:** the user tries the web app on real PRs; then the tree-sitter
  base (05) or the hosted mode.

## 2026-11-16: mac, Angular components

- With the user: the Angular link now; then an interface to try the tool as
  an app, and the tree-sitter base, rather than the GitHub Action first.
- TypeScript adapter: a component's template and styles are its parts; its
  selector, inputs and outputs are names. Core: kebab-case mentions.
  Independent stories ordered schema first (then size), which also fixes
  the 88-file PR's separated feature story. One private golden updated.
- The `.ai.md` orders were made on the previous static orders; re-running
  `bun corpus --ai` for the changed PRs costs ~0.50 USD.
- PRs are squash-merged from now on (the user's wish).
- **Next:** decide the interface (phase 07 before 06?) and the tree-sitter
  base (05).

## 2026-11-16: mac, corpus with AI

- The user agreed to the defaults (D20) and to sending all three
  corpus repositories' PRs. `bun corpus --ai` on all 28: ~1.40 USD, no dropped
  entries, no diff reads. `<id>.ai.md` next to each order, with notes.
- Fixes: move reasons shown in misc groups too; misc groups carry a
  `section`, so "standalone" is measured after the AI renames the group.
- Phase 04 closed for now; the notes on the `.ai.md` orders, the default
  (D19) and the use of weak links are listed under "Left for later".
- **Next:** merge the phase 04 PR; then phase 05 (more adapters), or the
  `.ai.md` notes first.

## 2026-11-16: mac, model and input comparison

- Cheaper models on ripple-review#3, then Opus 5.5 medium / Sonnet 5.5 high
  / Haiku 5.5 high, each with the full diff and with a summary plus a
  `read_diff` tool, on five private PRs and #3 (table in phase 04).
- Summary input (`--ai-input summary`): 60-70 % fewer input tokens, same
  quality; Opus and Sonnet never asked for a diff.
- Defaults now `claude-opus-5-5`, effort medium, summary input: ~0.09 USD
  per PR. Prompt caching removed; weak links matched in either direction.
- **Next:** `bun corpus --ai` on the whole corpus.

## 2026-11-16: mac, AI layer built

- `libs/core/src/ai.ts`: `ReviewModel` port, request (groups with ids,
  links, trimmed diff), JSON schema, lenient parsing, the answer applied as
  a validated patch, `fakeModel`; tests. `ReviewGroup.purpose`, rendered
  under the group title.
- `libs/ai-anthropic` on `@anthropic-ai/sdk` 1.6.0 (structured output,
  effort high, fallbacks opted in). CLI: `--ai`, `--no-ai`, `--ai-model`,
  `--ai-effort`; answers cached on disk. `bun corpus --ai` writes
  `<id>.ai.md` with its own notes and the cost.
- The user supplied an API key for this work; it is passed only as an
  environment variable, never written to the repo.
- Smoke test on ripple-review#3: ~0.23 USD, good names, one sensible move,
  correct weak links.
- **Next:** with the user's OK on cost and on which repositories may be sent
  to the API, run `bun corpus --ai` and compare.

## 2026-11-16: mac, phase 04 decisions

- PR #5 (phase 03) merged.
- With the user: the AI layer gets a provider-independent port in core and
  one library per provider, Anthropic first, no agent framework (Mastra and
  Genkit considered; D18). Opt-in by `--ai`, off by default (D19). O3
  answered.
- **Next:** implement phase 04 on `phase-04-ai-layer`: the port, input,
  schema and patch in core with a fake provider; `libs/ai-anthropic`; the
  flag and the cache; `bun corpus --ai`.

## 2026-11-16: mac, corpus tooling

- `bun corpus` (`apps/cli/src/corpus.ts`): reviews the PRs listed in the
  corpus folder's `corpus.json`, recording missing ones into
  `~/.cache/ripple-review/corpus/`. Writes `<repo>-<n>.md` (the order, then
  the user's Notes, kept across runs), `measures.json` and the table in the
  folder's `README.md`, and prints what changed against the last measures.
  Measures in `apps/cli/src/measures.ts`, with a test. (The corpus was in
  `.dev/…/data/corpus/` then; it is in the gitignored `local/corpus/` since
  D25, being of private repositories.)
- "Tests placed" counts tests in a story or in its mechanical edits: on
  the 88-file PR a 19-file import change holds most tests, so "in a story"
  alone said 22 % for an order that places all of them.
- `corpus.json` holds 28 proposed PRs from three private repositories
  (19, 4 and 5 PRs). GitHub's GraphQL API returned 502 for one
  repository's PR list; REST worked.
- The user accepted all 28. All recorded (25 MB in the cache) and run. A
  393-file PR failed first: GitHub serves no diff beyond 300 files, so the
  GitHub source now rebuilds it from the PR files API (`patchFromFiles`).
- First reading of the table: SQL-only refactors get no story and no edge
  at all; a helper replacing a constant in 13 files is 85 % standalone; PHP
  and Dart PRs are all unlinked, as expected.
- User's first notes: the SQL-only refactors are fine as they are, given
  that repository's migration setup. An inline value replaced by a shared
  constant should read as one edit. Done as the user suggested, by folding
  constants (`libs/core/src/constants.ts`): products of numbers and
  SCREAMING_CASE constants, values taken from definitions in the change.
  A removed and an added line with the same folded value cancel, and so
  does a local definition dropped for the imported one. That PR went from
  85 % to 0 % standalone, one group of 13 files; no other corpus PR changed
  and the two goldens stayed the same.
- On the user's question, folding also covers string constants
  (concatenation with `+`, `${NAME}` in template literals) and sums. A sum
  folds only as a whole expression (`x * 2 + 3` must not become `x * 5`).
  The same-value comparison keeps string literals (the mechanical
  normalization blanks paths, which would make `"/a"` equal `"/b"`), and
  only pairs that involve a constant cancel, so a quote-style change stays a
  plain edit. No corpus PR changed: none replaces strings or sums by a
  constant.
- User's note on a PR with 75 Dart import changes: "Repository config"
  (package.json build outputs) should come early, not last; it is their
  cause. Two changes in `order.ts`: config joins a story that has files in
  its directory also when those files are a mechanical edit, and config
  that joins no story now comes right after Context instead of last. The
  PR now reads package.json → export scripts → Dart imports. Goldens: only
  the config group moved (position 2); in ripple-review#3
  `vitest.shared.ts` now precedes the `vitest.config.ts` files that use it.
- User's notes on another PR: its schema group is generated, and two
  standalone files are core files.
  - Generated: a file of 1 MB or more at head is generated (the three
    PostGraphile/codegen outputs are 5–23 MB). The repo's generator configs
    name them too.
  - Keys: the new enum members' string values are what the migration and
    the spec use. The TS adapter now defines the string values of exported
    enums and `const X = "…"`, and a diff mentions a name also as a string
    literal's body. Side effect across the corpus: SQL functions now link
    to an error-codes module through the codes they raise (three PRs),
    which moves it into the DB story.
  - The new links split that PR's migration from a TS file into two
    stories that mention each other equally; such a tie now goes to the
    story with the more basic files (schema before source) instead of the
    smaller one.
- Seen in a third PR: an SQL function reaches the frontend as a mutation
  in camelCase (PostGraphile inflection); no link, the migration is
  standalone.
- Generator configs (the user's request): `libs/core/src/generators.ts`
  reads the outputs of graphql-codegen (`generates`, YAML or TS/JSON),
  Prisma, buf, sqlc, Orval, openapi-generator, kysely-codegen and
  PostGraphile's rc/preset files; paths relative to the config, a directory
  output covers everything below it. No corpus PR's files changed role:
  the large outputs were already caught by size. An export path set in a
  script with no standard name stays unread.
- snake_case ↔ camelCase links for names of three or more words: the
  migration above now opens its story before the mutation calling it; new
  real links in three other PRs and in the 88-file PR's golden (a TS name
  ↔ the migration's column).
- Corpus re-recorded (`--refresh`) so the recordings hold the configs.
- The user ended the review round for now. Remaining 03 items: identical
  new files are one mechanical group ("Same new file in 7 places"); new
  tests of unchanged code are grouped per project after "Standalone
  changes" (standalone share down in 10 corpus PRs, e.g. 96 % → 49 % and
  71 % → 29 %). Three private PRs promoted to fixtures. Four items moved
  to 04 (see its phase file). Phase 03 done.
- **Next:** PR for phase 03; then phase 04, which needs O3 (AI provider and
  cost) answered.

## 2026-11-16: mac, phase 03 questions answered

- PR #4 (dogfooding fixes) merged.
- Phase 03 set up with the user: corpus as refs and notes, recordings in a
  local cache (D14); free-text notes per PR (D15); PRs proposed by shape,
  vetoed by the user (D16); three private repositories (D17), one mostly
  PHP and one with Dart, neither with an adapter yet.
- **Next:** corpus tooling, then the candidate list for the user to veto.

## 2026-11-16: mac, dogfooding on PR #3

- PR #3 merged. Ran `ripple` on its own PR #3 and recorded it as the second
  fixture (`ripple-review-3`, 0.6 MB; in `local/fixtures/` since D25, as
  its recorded files include the private fixture).
- Fixed what was cheap and clear:
  - Golden `.md` files counted as docs ("Context: read first"). Data under
    `fixtures/`, `__snapshots__/` and `testdata/` is now test-support, but
    only if no adapter parses the file. A first version without that
    condition made a migration tool's `migrations/fixtures/*.sql` functions
    test data and broke the 88-file PR's SQL story; the golden diff caught it.
  - Mechanical edits blanked every string literal, so in JSON
    `"linter": {` matched `"scripts": {` and `biome.json` joined the
    `test:unit` scripts group. Now only path-like literals are blanked.
  - `nx.json`, `project.json`, `lefthook.yml`, `renovate.json5` and
    `vitest.*`/`vite.*` files are config.
  The 88-file PR's order is unchanged by all three.
- Left for 03 (they change how stories form; tune against several PRs):
  config files are not clustered along their imports (`vitest.shared.ts`
  vs. its 7 `vitest.config.ts`); identical new files are not a mechanical
  group; an import edge counts even if the diff doesn't touch it (the
  `exports` fix in `typescript.ts` joined the `model.ts` story through type
  imports); new tests of unchanged code end up in "Standalone".
- **Next:** phase 03.

## 2026-11-16: mac, phase 02 tests and fixtures

- PR #2 merged (rebase merge, keeping the move and the formatting apart).
- Vitest (D12): 131 tests in 7 projects, all offline. The TS resolution tests
  found the `exports` condition bug (phase 02 file); the 88-file PR unaffected.
- `--record` / `--fixture` (D13). The 88-file PR has new commits since the
  first example output (90 files, was 88); the fixture records today's
  head, and its `expected.md` is the new reference.
- First recording was 12 MB of JSON (generated schemas, ~1,400 TS files read
  through barrels); gzipped to 1.6 MB.
- PR #3.
- **Next:** merge #3, then phase 03 (decide where the corpus lives).

## 2026-11-16: mac, phase 01 tooling and CI

- Moved `src/` into the Nx layout (D11) with `git mv`, renamed to
  `ripple-review` / `ripple` (D10). Output on the 88-file PR is
  byte-identical to the example output (Markdown and JSON) after the move.
- Nx failed on Bun 1.4's v2 `bun.lock` ("Unsupported lockfile version 2");
  `analyzeLockfile: false` (D11).
- Biome: a first `--write --unsafe` rewrote `x!.y` to `x?.y` in 18 places
  and broke typecheck; redone with safe fixes plus only
  `useBlockStatements`. 89 `noNonNullAssertion` warnings remain.
- CI (`biome`, `typecheck-and-test`) on GitHub Actions (D9).
- The cache moved to `~/.cache/ripple-review/`; the old
  `~/.cache/semantic-codereview/` can be deleted.
- PR #2; both jobs green (typecheck ran for all 7 projects). Branch
  protection is unavailable on GitHub Free for a private repo, so "PRs,
  merge with CI green" is a convention.
- **Next:** merge #2, then phase 02 (tests).

## 2026-11-16: mac, idea to working CLI prototype

- Discussed the idea (D1) and the static + AI split (D2). Walked through
  a private 88-file PR (TypeScript, SQL, GraphQL) by hand: alphabetical
  order puts `apps/api` before `libs/`; ~1,500 of 4,500 added lines are
  generated; the PR mixes the feature with two refactors and a type moved
  between libraries (17 one-line import edits).
- Built the CLI (phase 00, `39ba603`): sources (GitHub PR via `gh` plus a
  shallow fetch into `~/.cache/semantic-codereview`, local git), adapters
  (TS/JS, SQL, GraphQL; D3), core (barrel following, name links,
  classification, mechanical edits, Louvain stories; D5, D6), Markdown/JSON.
- Iterations on that PR: a recursion guard stopped barrel following after
  32 files (a barrel re-exports ~100); generated files as name definers linked
  everything (D6); connected components gave one 44-file story (D5); one
  `git cat-file` per file took 14 s, a single `--batch` call brings it to ~2 s.
- Also ran on a local range of five commits (39 files, 8 groups, ~1 s).
- Repo `volkmann-design-code/ripple-review` created by the user (D7); stack
  (D8) and CI (D9) recorded.
- **Next:** phase 01 (Nx workspace, rename, lefthook, Biome, CI).
