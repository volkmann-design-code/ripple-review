---
id: 07-web-app
title: "Web app: local first, hosted later"
status: in-progress
depends_on: [04-ai-layer]
branch: phase-07-web-app
pr: null
updated: 2026-11-16
---

# 07 Web app

D21 (replaces "review UI, only if 06 proves the value"; now before 06).

## v1: local mode

- [x] `libs/engine`: the review pipeline (adapters, review, AI wiring,
      measures) moved out of `apps/cli`, shared by the CLI and the server.
- [x] `libs/api-contract`: the JSON types between server and clients.
- [x] `apps/server` (Hono on Bun, 127.0.0.1:3001): reviews of a PR or a
      recorded fixture, `?ai=1` refined by the AI layer (D20), ticks per
      file kept while the file's diff is unchanged (like GitHub's
      "viewed"), open PRs of a repository; GitHub via `gh`, ticks in
      `$XDG_DATA_HOME/ripple-review/progress`. With a built web app it
      serves that too (one port).
- [x] `apps/web` (Angular 22, zoneless, signals, Tailwind 4; setup from
      the user's other Angular apps): start page (paste a PR, list a repository's open PRs,
      fixtures), review page (outline with progress, groups with names
      and purposes, files with notes and ticks, diffs inline, mechanical
      groups with one diff, generated folded, "Refine with AI").
      Routes mirror GitHub: `/<owner>/<repo>/pull/<n>`.
- [x] `bun dev` (server + `ng serve` with proxy) and `bun serve` (built app
      on one port).
- [ ] The user tries it on real PRs; fixes from that. First round:
  - [x] outline links scroll to the group (they pointed at `/#group-n`);
  - [x] the AI choice is remembered per change (with the ticks), so a
        reload keeps the refined order; "Static order" switches back;
  - [x] progress: the review streams its steps (`?stream=1`, NDJSON) with
        an elapsed time; GitHub loading is async now (`loadGitHubPrAsync`);
  - [x] syntax highlighting (Shiki, GitHub light/dark, loaded lazily) and
        GitHub-style expansion of the unchanged lines around hunks (the
        file at head via `/file?path=`);
  - [x] sticky group and file headers;
  - [x] Material Symbols (rounded) for all icons;
  - [x] the review page split into small presentational components
        (`review/components/`), the page and `rr-file-diff` the only ones
        that inject anything.

Notes:
- TypeScript 6.0.3 for the workspace (Angular 22 needs 6.0).
- `tsconfig.angular.json` sets `rewriteRelativeImportExtensions`: the
  libraries import with `.ts` extensions, which Angular's emit needs
  rewritten.
- Biome lints the templates: `a11y/useValidAnchor` is off for
  `apps/web/**/*.html`, because it doesn't see Angular's `routerLink` and
  `[href]` as an href.
- The server's loaders are synchronous (`gh`, `git` via `execFileSync`):
  fine for one local user, to be made async for hosting. (Gone with the
  server, D22.)
- Browser-only (step 3): the worker has its own tsconfig (`webworker` lib;
  the libraries' index-signature access allowed); the page imports only
  types from `src/engine/api.ts`, so Angular's stricter flags don't reach
  the libraries. Dev servers (and some hosts) send `.gz` files with
  `Content-Encoding: gzip`: `gunzip` takes already unpacked data as text.
  Fixtures hold the recorded repositories' source, so production builds
  leave them out.

## Hosted: browser-only (D22)

Each step one PR.

- [x] Runtime-neutral core and engine: async `Snapshot` (adapters init
      async with the path set, resolve sync), own path helpers instead of
      `node:path`, a `Store` port for AI answers (`FileStore` in
      `libs/engine/src/node/` for the CLI and server, keys by Web Crypto
      SHA-256, same keys as before), Biome forbids `node:`/Bun imports in
      core and engine. Golden orders unchanged; the 88-file PR live in the
      same ~2 s.
- [x] `Forge` port (core) and `libs/forge-github` on the GitHub API: REST
      for the PR, its diff (rebuilt from the files API when too large) and
      the tree; GraphQL for file contents, 25 per query, 20 queries at a
      time; open PRs; deep links (a synchronous SHA-256 in core). CLI,
      corpus and local server use it, `gh` only for the token
      (`GITHUB_TOKEN` / `GH_TOKEN` / `gh auth token`); the bare cache repos
      are gone. Snapshots batch reads asked for together (`batched`), the
      graph asks for them level by level (barrel trees breadth-first), and
      `prefetch` is gone. The 88-file PR: identical order, ~10 s through the API
      (6 rounds of reads, ~1 700 files) instead of ~2 s with git; 51 s
      before the batching work. A tarball is no alternative: 60 MB, and
      codeload doesn't allow browser origins.
- [x] The web app runs the engine in a Web Worker (`apps/web/src/engine/`:
      `Backend` behind `EngineService`, messages with stages as the server
      streamed them); settings page for the GitHub token and the Anthropic
      key (this tab's session, or "remember on this device"), sent only to
      GitHub and Anthropic; ticks, AI choice and AI answers in IndexedDB
      through `Store` (now in core); file contents cached by blob SHA in
      `forge-github` (the 88-file PR in a new session: 3 requests and 2 s instead
      of 76 and 12 s); the engine with the TypeScript compiler a lazy
      chunk (3.6 MB, ~0.8 MB transferred) loaded on the first review, the
      Anthropic SDK another; fixtures as assets in development builds only
      (`apps/web/fixtures` links to `apps/cli/fixtures`; `index.json`
      lists them), read with `DecompressionStream`. `apps/server` removed;
      `bun dev` is `ng serve` alone. "Clear stored data" deletes it all.
- [x] "Viewed" synced with GitHub's: `ViewedMarks`, an optional
      capability on `Forge` (`get`/`set` per change); GitHub through
      GraphQL (`viewerViewedState`, 100 files per page; aliased
      `markFileAsViewed`/`unmarkFileAsViewed`, 50 per request, a path no
      longer in the PR skipped). Ticks are GitHub's marks: read while the
      change loads and is analysed, set on every tick, one save after the
      other per change. "Dismissed" (viewed, then changed) shows unticked.
      A tick GitHub refuses (token without write access to pull requests)
      or can't take stays in the browser as pending and is sent on the next
      load; the page says why and links to Settings. Live on #12: tick →
      Viewed on GitHub, marked on GitHub → ticked, untick → unmarked.
      Reviews (posting comments) later.
- [x] Progress and saved reviews (after the user's test of step 4): the
      analysis reports its steps (setup, changed files read, files read to
      follow imports, linking, ordering), shown with counts; reviews,
      static and AI, saved on the device by change and diff (IndexedDB
      `reviews`, keyed by `SAVED_REVIEWS.version`, which a test ties to
      the golden orders), so a reload with the same diff skips the
      analysis; the review page and Settings say what is stored.
- [x] Reviews on GitHub (D23): `ForgeReviews`, an optional capability on
      `Forge` with its features (ranges, file comments, the ways to
      submit); GitHub over GraphQL (`reviewThreads`,
      `addPullRequestReviewThread` with the pull request's ID, which starts
      the pending review, `updatePullRequestReviewComment`,
      `deletePullRequestReviewComment`, an emptied pending review deleted,
      `submitPullRequestReview` or `addPullRequestReview` without drafts).
      The engine's `Drafts` keeps what GitHub didn't take as operations in
      IndexedDB `drafts` and sends them on the next load. On the page: "+"
      on a diff line (shift-click: a range in the same hunk), a comment
      button per file, drafts editable and deletable in place, existing
      threads read-only at their lines (outdated ones and those on hidden
      lines above the diff), and a review bar sticking below the app header
      (draft count; it opens the summary
      and Comment / Approve / Request changes; only Comment on your own
      pull request; a review without drafts is the summary alone). Live on #14: line, range, old-side and file drafts
      added, edited, read back after a reload and deleted; nothing
      submitted. Replies and resolving later.
- [x] Cleanup before the deploy (the user's list): the recorded fixtures
      are gone from the web app (route, start page, assets, `index.json`,
      `ChangeRef`'s `fixture` kind; the engine's tests replay a fixture
      through a fake `Forge`); the outline lists each group's files, and a
      scroll spy (`ScrollSpy`, an `IntersectionObserver` on a line below
      the sticky headers) opens only the group being read and marks its
      file; "Recently viewed" on the start page (IndexedDB `changes`,
      version 4: title, when opened, files ticked, the AI answers about
      it); Settings lists what is stored per pull request, the file
      contents and the token, key and last repository, each deletable on
      its own (`ListedStore` in core: `list`, `delete`).
- [x] Static deploy (D24): `deploy.yml` after green CI on main, tar over
      SSH, `index.html` last, the previous release's bundles kept;
      `apps/web/public/.htaccess` with the routes, a strict CSP and
      caching; critical-CSS inlining off (its inline script). Tried from
      the Mac before the PR: three releases (bundles kept one release,
      then deleted), headers, 404s for dot paths and missing bundles, and
      a review of a public PR in headless Chrome without a CSP violation.
- [ ] A second forge: GitLab (gitlab.com and self-hosted).
