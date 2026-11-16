import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import type { Route } from "@playwright/test";

/*
 * GitHub's API as the web app's forge (libs/forge-github) calls it, answered
 * from a recorded fixture (apps/cli/fixtures/<name>): the pull request, its
 * diff, the tree and the files read, the user's "Viewed" marks and review
 * threads. Only what the screenshots need; mutations succeed and change
 * nothing.
 */

export interface FakeThread {
  path: string;
  /** a line on the new side of the diff */
  line: number;
  author: string;
  body: string;
}

export interface FakePull {
  /** the fixture's folder */
  dir: string;
  repo: string;
  number: number;
  /** files the user has marked "Viewed" */
  viewed?: string[];
  threads?: FakeThread[];
}

interface Fixture {
  title: string;
  url: string;
  patch: string;
  tree: string[];
  files: Record<string, string>;
}

function load(dir: string): Fixture {
  const gunzip = (name: string) =>
    gunzipSync(readFileSync(join(dir, name))).toString("utf8");
  const meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8"));
  return {
    title: meta.title,
    url: meta.url,
    patch: readFileSync(join(dir, "diff.patch"), "utf8"),
    tree: gunzip("tree.txt.gz").split("\n").filter(Boolean),
    files: JSON.parse(gunzip("files.json.gz")),
  };
}

/** The new-side number of the line added to `path` that contains `text`. */
export function addedLine(dir: string, path: string, text: string): number {
  const patch = readFileSync(join(dir, "diff.patch"), "utf8");
  const start = patch.indexOf(`diff --git a/${path} b/${path}\n`);
  const end = patch.indexOf("\ndiff --git ", start + 1);
  let line = 0;
  for (const row of patch.slice(start, end < 0 ? undefined : end).split("\n")) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(row);
    if (hunk) {
      line = Number(hunk[1]);
    } else if (line && row.startsWith("+") && row.includes(text)) {
      return line;
    } else if (line && !row.startsWith("-")) {
      line++;
    }
  }
  throw new Error(`no added line with "${text}" in ${path}`);
}

const sha = (s: string) => createHash("sha1").update(s).digest("hex");
const HEAD = sha("head");
const BASE = sha("base");
const PULL_ID = "PR_fake";

/** A route handler for `https://api.github.com/**`. */
export function fakeGitHub(pull: FakePull) {
  const fx = load(pull.dir);
  const viewed = new Set(pull.viewed ?? []);
  const [owner = "", name = ""] = pull.repo.split("/");

  const rest: Record<string, () => unknown> = {
    [`/repos/${pull.repo}/pulls/${pull.number}`]: () => ({
      number: pull.number,
      title: fx.title,
      html_url: fx.url,
      head: { sha: HEAD, ref: "feature" },
      base: { sha: BASE, ref: "main" },
    }),
    [`/repos/${pull.repo}/git/trees/${HEAD}?recursive=1`]: () => ({
      tree: fx.tree.map((path) => ({
        path,
        type: "blob",
        sha: sha(`${path}\n${fx.files[path] ?? ""}`),
      })),
    }),
    [`/repos/${pull.repo}/pulls?state=open&sort=updated&direction=desc&per_page=100`]:
      () => [],
  };

  const graphql = (query: string, vars: Record<string, string>) => {
    if (query.startsWith("mutation")) {
      return {};
    }
    if (query.includes("object(expression:")) {
      const repository: Record<string, { text: string } | null> = {};
      for (const [key, expr] of Object.entries(vars)) {
        if (/^e\d+$/.test(key)) {
          const text = fx.files[expr.slice(expr.indexOf(":") + 1)];
          repository[`f${key.slice(1)}`] = text === undefined ? null : { text };
        }
      }
      return { repository };
    }
    if (query.includes("viewerViewedState")) {
      const paths = [...fx.patch.matchAll(/^diff --git a\/\S+ b\/(\S+)$/gm)];
      return {
        repository: {
          pullRequest: {
            id: PULL_ID,
            files: {
              nodes: paths.map(([, path = ""]) => ({
                path,
                viewerViewedState: viewed.has(path) ? "VIEWED" : "UNVIEWED",
              })),
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        },
      };
    }
    if (query.includes("reviewThreads")) {
      return {
        repository: {
          pullRequest: {
            viewerDidAuthor: false,
            reviewThreads: {
              nodes: (pull.threads ?? []).map((t, i) => ({
                id: `thread-${i}`,
                isResolved: false,
                isOutdated: false,
                path: t.path,
                line: t.line,
                startLine: null,
                originalLine: t.line,
                originalStartLine: null,
                diffSide: "RIGHT",
                startDiffSide: null,
                subjectType: "LINE",
                comments: {
                  nodes: [
                    {
                      id: `comment-${i}`,
                      body: t.body,
                      state: "SUBMITTED",
                      createdAt: "2026-11-16T09:30:00Z",
                      url: `${fx.url}#discussion_r${i}`,
                      author: { login: t.author },
                    },
                  ],
                },
              })),
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        },
      };
    }
    if (query.includes("pullRequest(number: $number) { id }")) {
      return { repository: { pullRequest: { id: PULL_ID } } };
    }
    throw new Error(`fake GitHub: no answer for ${query.slice(0, 80)}`);
  };

  return async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (body: unknown) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify(body),
      });
    if (req.method() === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "GET, POST",
        },
      });
    }
    if (url.pathname === "/graphql") {
      const { query, variables } = req.postDataJSON();
      return json({ data: graphql(query, { owner, name, ...variables }) });
    }
    const path = url.pathname + url.search;
    if (
      path === `/repos/${pull.repo}/pulls/${pull.number}` &&
      req.headers()["accept"] === "application/vnd.github.diff"
    ) {
      return route.fulfill({
        status: 200,
        contentType: "text/plain",
        headers: { "access-control-allow-origin": "*" },
        body: fx.patch,
      });
    }
    const answer = rest[path];
    if (answer) {
      return json(answer());
    }
    console.warn(`fake GitHub: no answer for ${req.method()} ${path}`);
    return route.fulfill({
      status: 404,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ message: "Not Found" }),
    });
  };
}
