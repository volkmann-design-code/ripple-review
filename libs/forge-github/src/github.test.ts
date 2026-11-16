import { createHash } from "node:crypto";
import { ForgeError } from "@ripple-review/core/forge";
import { MemoryStore } from "@ripple-review/core/store";
import { describe, expect, it } from "vitest";
import { GitHubForge, githubFileLink } from "./github.ts";

const DIFF = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1 +1 @@
-export const a = 1;
+export const a = 2;
`;

const FILES: Record<string, string> = {
  "src/a.ts": "export const a = 2;\n",
  "src/b.ts": "export const b = 1;\n",
};

interface Call {
  url: string;
  accept?: string;
  body?: { query: string; variables: Record<string, string> };
}

/** The pull request's files on the fake GitHub, with the user's marks. */
const PR_FILES = ["src/a.ts", "src/c.ts", "src/d.ts"];

/** A fake GitHub: the routes the forge uses, recording every call. */
function fakeGitHub(
  overrides: Record<string, () => Response> = {},
  options: { blobs?: MemoryStore } = {},
  marks: {
    viewed?: Map<string, string>;
    /** The token may read but not mark files. */
    readOnly?: boolean;
  } = {},
) {
  const calls: Call[] = [];
  const viewed = marks.viewed ?? new Map<string, string>();
  const json = (v: unknown, status = 200) =>
    new Response(JSON.stringify(v), {
      status,
      headers: { "content-type": "application/json" },
    });
  const fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const call: Call = { url, accept: headers.Accept };
    if (init?.body) {
      call.body = JSON.parse(String(init.body));
    }
    calls.push(call);
    const path = url.replace("https://api.github.com", "");
    const key = `${path} ${headers.Accept ?? ""}`.trim();
    const override = Object.entries(overrides).find(([k]) => key.startsWith(k));
    if (override) {
      return override[1]();
    }
    if (path === "/repos/o/r/pulls/7" && headers.Accept?.endsWith(".diff")) {
      return new Response(DIFF);
    }
    if (path === "/repos/o/r/pulls/7") {
      return json({
        title: "A title",
        html_url: "https://github.com/o/r/pull/7",
        head: { sha: "h1" },
        base: { sha: "b1" },
      });
    }
    if (path.startsWith("/repos/o/r/git/trees/h1")) {
      return json({
        tree: [
          { path: "src", type: "tree" },
          ...Object.keys(FILES).map((p) => ({
            path: p,
            type: "blob",
            sha: `blob-of-${p}`,
          })),
        ],
      });
    }
    if (path === "/graphql" && call.body?.query.startsWith("mutation")) {
      const vars = call.body.variables;
      const data: Record<string, unknown> = {};
      const errors: { type: string; message: string; path: string[] }[] = [];
      for (const m of call.body.query.matchAll(
        /(m\d+): (markFileAsViewed|unmarkFileAsViewed)\(input: \{ pullRequestId: \$id, path: \$(p\d+)/g,
      )) {
        const [, alias = "", op, p = ""] = m;
        const file = vars[p] ?? "";
        data[alias] = null;
        if (marks.readOnly) {
          errors.push({
            type: "FORBIDDEN",
            message: "Resource not accessible by personal access token",
            path: [alias],
          });
        } else if (vars.id !== "PR_7" || !PR_FILES.includes(file)) {
          errors.push({
            type: "UNPROCESSABLE",
            message: "Filepath must be part of pull request",
            path: [alias],
          });
        } else {
          viewed.set(file, op === "markFileAsViewed" ? "VIEWED" : "UNVIEWED");
          data[alias] = { clientMutationId: null };
        }
      }
      return json({ data, ...(errors.length ? { errors } : {}) });
    }
    if (path === "/graphql" && call.body?.query.includes("pullRequest(")) {
      const { number, after } = call.body.variables as unknown as {
        number: number;
        after?: string | null;
      };
      if (number !== 7) {
        return json({ data: { repository: { pullRequest: null } } });
      }
      // Two files per page, to page through them.
      const start = after ? Number(after) : 0;
      const nodes = PR_FILES.slice(start, start + 2).map((p) => ({
        path: p,
        viewerViewedState: viewed.get(p) ?? "UNVIEWED",
      }));
      const hasNextPage = start + 2 < PR_FILES.length;
      return json({
        data: {
          repository: {
            pullRequest: {
              id: "PR_7",
              files: {
                nodes,
                pageInfo: {
                  hasNextPage,
                  endCursor: hasNextPage ? String(start + 2) : null,
                },
              },
            },
          },
        },
      });
    }
    if (path === "/graphql" && call.body) {
      const repository: Record<string, { text: string } | null> = {};
      for (const [k, v] of Object.entries(call.body.variables)) {
        if (k.startsWith("e")) {
          const text = FILES[v.slice("h1:".length)];
          repository[`f${k.slice(1)}`] = text === undefined ? null : { text };
        }
      }
      return json({ data: { repository } });
    }
    if (path.startsWith("/repos/o/r/pulls?")) {
      return json([
        {
          number: 7,
          title: "A title",
          html_url: "https://github.com/o/r/pull/7",
          user: { login: "someone" },
          updated_at: "2026-11-16T10:00:00Z",
          draft: true,
          head: { ref: "feature-b", repo: { full_name: "o/r" } },
          base: {
            ref: "feature-a",
            repo: { full_name: "o/r", default_branch: "main" },
          },
        },
        {
          number: 8,
          title: "From a fork",
          html_url: "https://github.com/o/r/pull/8",
          user: null,
          updated_at: "2026-11-15T10:00:00Z",
          head: { ref: "main", repo: null },
          base: {
            ref: "main",
            repo: { full_name: "o/r", default_branch: "main" },
          },
        },
      ]);
    }
    return json({ message: "Not Found" }, 404);
  }) as typeof globalThis.fetch;
  return {
    forge: new GitHubForge({ token: "t", fetch, ...options }),
    calls,
    viewed,
  };
}

describe("GitHubForge.parseChange", () => {
  const { forge } = fakeGitHub();
  it.each([
    ["owner/repo#12", { repo: "owner/repo", number: 12 }],
    ["my-org/my.repo/pull/3", { repo: "my-org/my.repo", number: 3 }],
    ["https://github.com/o/r/pull/1684/files", { repo: "o/r", number: 1684 }],
  ])("%s", (input, ref) => {
    expect(forge.parseChange(input)).toEqual(ref);
  });

  it.each(["owner/repo", "#12", "https://gitlab.com/o/r/-/merge_requests/1"])(
    "rejects %s",
    (input) => {
      expect(forge.parseChange(input)).toBeUndefined();
    },
  );

  it("reads URLs of its own host when self-hosted", () => {
    const ghes = new GitHubForge({
      token: "t",
      webUrl: "https://git.example.com",
    });
    expect(ghes.parseChange("https://git.example.com/a/b/pull/2")).toEqual({
      repo: "a/b",
      number: 2,
    });
    expect(ghes.parseChange("https://github.com/a/b/pull/2")).toBeUndefined();
  });
});

describe("GitHubForge.loadChange", () => {
  it("loads the diff and reads head through the API, files read together in one query", async () => {
    const { forge, calls } = fakeGitHub();
    const stages: string[] = [];
    const cs = await forge.loadChange(
      { repo: "o/r", number: 7 },
      { stage: (m) => stages.push(m) },
    );
    expect(cs.title).toBe("A title");
    expect(cs.revision).toBe("b1..h1");
    expect(cs.files.map((f) => f.path)).toEqual(["src/a.ts"]);
    expect(stages).toEqual(["Reading the pull request", "Fetching the diff"]);

    expect(await cs.head.list()).toEqual(["src/a.ts", "src/b.ts"]);
    const [a, b, missing] = await Promise.all([
      cs.head.read("src/a.ts"),
      cs.head.read("src/b.ts"),
      cs.head.read("nope.ts"),
    ]);
    expect([a, b, missing]).toEqual([
      FILES["src/a.ts"],
      FILES["src/b.ts"],
      undefined,
    ]);
    const queries = calls.filter((c) => c.url.endsWith("/graphql"));
    expect(queries).toHaveLength(1);
    expect(queries[0]?.body?.variables).toMatchObject({
      owner: "o",
      name: "r",
      e0: "h1:src/a.ts",
      e1: "h1:src/b.ts",
    });
    expect(
      calls.every((c) => c.url.startsWith("https://api.github.com/")),
    ).toBe(true);
  });

  it("reuses the previous load when base and head are unchanged", async () => {
    const { forge, calls } = fakeGitHub();
    const first = await forge.loadChange({ repo: "o/r", number: 7 });
    const before = calls.length;
    const again = await forge.loadChange(
      { repo: "o/r", number: 7 },
      { previous: first },
    );
    expect(again.head).toBe(first.head);
    expect(calls.length - before).toBe(1);
  });

  it("reads files it has seen before from the blob cache, by blob SHA", async () => {
    const blobs = new MemoryStore();
    const graphql = (calls: Call[]) =>
      calls.filter((c) => c.url.endsWith("/graphql")).length;

    const first = fakeGitHub({}, { blobs });
    const a = await first.forge.loadChange({ repo: "o/r", number: 7 });
    expect(await a.head.read("src/a.ts")).toBe(FILES["src/a.ts"]);
    expect(graphql(first.calls)).toBe(1);
    expect(await blobs.get("blob-of-src/a.ts")).toBe(FILES["src/a.ts"]);

    // A later load (another session, another pull request with the same
    // blob) asks GitHub only for what isn't cached.
    const second = fakeGitHub({}, { blobs });
    const b = await second.forge.loadChange({ repo: "o/r", number: 7 });
    expect(await b.head.read("src/a.ts")).toBe(FILES["src/a.ts"]);
    expect(graphql(second.calls)).toBe(0);
    expect(await b.head.read("src/b.ts")).toBe(FILES["src/b.ts"]);
    const query = second.calls.find((c) => c.url.endsWith("/graphql"));
    expect(query?.body?.variables).toMatchObject({ e0: "h1:src/b.ts" });
    expect(query?.body?.variables).not.toHaveProperty("e1");
  });

  it("rebuilds the diff from the files API when GitHub won't serve it whole", async () => {
    const { forge } = fakeGitHub({
      "/repos/o/r/pulls/7 application/vnd.github.diff": () =>
        new Response("too_large", { status: 406 }),
      "/repos/o/r/pulls/7/files": () =>
        new Response(
          JSON.stringify([
            {
              filename: "src/a.ts",
              status: "modified",
              patch: "@@ -1 +1 @@\n-export const a = 1;\n+export const a = 2;",
            },
          ]),
        ),
    });
    const cs = await forge.loadChange({ repo: "o/r", number: 7 });
    expect(cs.files.map((f) => [f.path, f.additions, f.deletions])).toEqual([
      ["src/a.ts", 1, 1],
    ]);
  });

  it("says what went wrong in words the user can act on", async () => {
    const { forge } = fakeGitHub({
      "/repos/o/r/pulls/7": () => new Response("{}", { status: 401 }),
    });
    const err = await forge
      .loadChange({ repo: "o/r", number: 7 })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ForgeError);
    expect(err).toMatchObject({ status: 401 });
    await expect(
      fakeGitHub().forge.loadChange({ repo: "o/missing", number: 1 }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("GitHubForge.viewed", () => {
  const ref = { repo: "o/r", number: 7 };
  const graphql = (calls: Call[]) =>
    calls.filter((c) => c.url.endsWith("/graphql"));

  it("reads the user's marks of every file, page by page", async () => {
    const { forge } = fakeGitHub(
      {},
      {},
      {
        viewed: new Map([
          ["src/a.ts", "VIEWED"],
          ["src/d.ts", "DISMISSED"],
        ]),
      },
    );
    expect(await forge.viewed.get(ref)).toEqual(
      new Map([
        ["src/a.ts", "viewed"],
        ["src/c.ts", "unviewed"],
        ["src/d.ts", "dismissed"],
      ]),
    );
  });

  it("marks and unmarks files in one request, skipping paths not in the pull request", async () => {
    const { forge, calls, viewed } = fakeGitHub(
      {},
      {},
      { viewed: new Map([["src/c.ts", "VIEWED"]]) },
    );
    await forge.viewed.get(ref);
    const before = graphql(calls).length;
    await forge.viewed.set(ref, [
      { path: "src/a.ts", viewed: true },
      { path: "src/c.ts", viewed: false },
      { path: "gone.ts", viewed: true },
    ]);
    // The pull request's ID came with the marks: one request for all three.
    expect(graphql(calls).length - before).toBe(1);
    expect(viewed).toEqual(
      new Map([
        ["src/a.ts", "VIEWED"],
        ["src/c.ts", "UNVIEWED"],
      ]),
    );
  });

  it("looks up the pull request's ID when marking first", async () => {
    const { forge, calls, viewed } = fakeGitHub();
    await forge.viewed.set(ref, [{ path: "src/d.ts", viewed: true }]);
    expect(graphql(calls)).toHaveLength(2);
    expect(viewed.get("src/d.ts")).toBe("VIEWED");
  });

  it("says when the token may not mark files", async () => {
    const { forge } = fakeGitHub({}, {}, { readOnly: true });
    await expect(
      forge.viewed.set(ref, [{ path: "src/a.ts", viewed: true }]),
    ).rejects.toMatchObject({
      status: 403,
      hint: expect.stringMatching(/Pull requests/),
    });
  });

  it("fails with 404 for a pull request that isn't there", async () => {
    const { forge } = fakeGitHub();
    await expect(
      forge.viewed.get({ repo: "o/r", number: 8 }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("GitHubForge.listChanges", () => {
  it("lists open pull requests with their branches", async () => {
    const { forge } = fakeGitHub();
    expect(await forge.listChanges("o/r")).toEqual([
      {
        number: 7,
        title: "A title",
        url: "https://github.com/o/r/pull/7",
        author: "someone",
        updatedAt: "2026-11-16T10:00:00Z",
        draft: true,
        head: "feature-b",
        base: "feature-a",
        defaultBranch: "main",
        fromFork: false,
      },
      {
        number: 8,
        title: "From a fork",
        url: "https://github.com/o/r/pull/8",
        author: undefined,
        updatedAt: "2026-11-15T10:00:00Z",
        draft: false,
        head: "main",
        base: "main",
        defaultBranch: "main",
        fromFork: true,
      },
    ]);
  });
});

describe("githubFileLink", () => {
  it("points at the file's anchor in Files changed", () => {
    const sha = createHash("sha256").update("src/a.ts").digest("hex");
    expect(githubFileLink("https://github.com/o/r/pull/1", "src/a.ts")).toBe(
      `https://github.com/o/r/pull/1/files#diff-${sha}`,
    );
  });
});
