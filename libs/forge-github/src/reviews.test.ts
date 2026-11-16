import { ForgeError } from "@ripple-review/core/forge";
import { describe, expect, it } from "vitest";
import type { GraphQL, GraphQLBody } from "./graphql.ts";
import { GitHubReviews } from "./reviews.ts";

const REF = { repo: "o/r", number: 7 };
/** Lines GitHub accepts comments on, per path ("new" side). */
const DIFF_LINES: Record<string, number[]> = { "src/a.ts": [1, 2, 3, 10] };

interface FakeThread {
  id: string;
  path: string;
  line: number | null;
  startLine: number | null;
  side: "LEFT" | "RIGHT";
  file: boolean;
  outdated?: boolean;
  comments: { id: string; body: string; state: string; author: string }[];
}

/** GitHub's review mutations and queries, as far as the port uses them. */
function fakeGitHub(options: { readOnly?: boolean; author?: boolean } = {}) {
  let next = 0;
  const state = {
    pending: undefined as string | undefined,
    threads: [] as FakeThread[],
    submitted: [] as { event: string; body: string; via: string }[],
  };
  const forbidden = {
    errors: [
      {
        type: "FORBIDDEN",
        message: "Resource not accessible by personal access token",
      },
    ],
  };
  const comments = () => state.threads.flatMap((t) => t.comments);
  const json = (t: FakeThread) => ({
    id: t.id,
    isResolved: false,
    isOutdated: t.outdated ?? false,
    path: t.path,
    line: t.outdated ? null : t.line,
    startLine: t.outdated ? null : t.startLine,
    originalLine: t.line,
    originalStartLine: t.startLine,
    diffSide: t.side,
    startDiffSide: t.startLine === null ? null : t.side,
    subjectType: t.file ? "FILE" : "LINE",
    comments: {
      nodes: t.comments.map((c) => ({
        ...c,
        createdAt: "2026-11-16T00:00:00Z",
        url: `https://github.com/o/r/pull/7#${c.id}`,
        author: { login: c.author },
      })),
    },
  });
  const graphql: GraphQL = async <T>(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<GraphQLBody<T>> => {
    const body = (b: unknown) => b as GraphQLBody<T>;
    if (query.includes("reviewThreads(")) {
      return body({
        data: {
          repository: {
            pullRequest: {
              viewerDidAuthor: options.author ?? false,
              reviewThreads: {
                nodes: state.threads.map(json),
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        },
      });
    }
    if (query.includes("reviews(states: PENDING")) {
      return body({
        data: {
          repository: {
            pullRequest: {
              id: "PR_7",
              reviews: { nodes: state.pending ? [{ id: state.pending }] : [] },
            },
          },
        },
      });
    }
    if (options.readOnly) {
      return body(forbidden);
    }
    if (query.includes("addPullRequestReviewThread")) {
      const input = variables["input"] as Record<string, unknown>;
      const path = String(input["path"]);
      const line = input["line"] as number | undefined;
      if (
        input["pullRequestId"] !== "PR_7" ||
        (line !== undefined && !DIFF_LINES[path]?.includes(line))
      ) {
        return body({ data: { addPullRequestReviewThread: { thread: null } } });
      }
      state.pending ??= `PRR_${++next}`;
      const t: FakeThread = {
        id: `PRRT_${++next}`,
        path,
        line: line ?? 1,
        startLine: (input["startLine"] as number | undefined) ?? null,
        side: (input["side"] as "LEFT" | "RIGHT" | undefined) ?? "RIGHT",
        file: input["subjectType"] === "FILE",
        comments: [
          {
            id: `PRRC_${++next}`,
            body: String(input["body"]),
            state: "PENDING",
            author: "me",
          },
        ],
      };
      state.threads.push(t);
      return body({
        data: { addPullRequestReviewThread: { thread: json(t) } },
      });
    }
    if (query.includes("updatePullRequestReviewComment")) {
      const c = comments().find((c) => c.id === variables["id"]);
      if (!c) {
        return body({ errors: [{ type: "NOT_FOUND", message: "gone" }] });
      }
      c.body = String(variables["body"]);
      return body({ data: { updatePullRequestReviewComment: {} } });
    }
    if (query.includes("deletePullRequestReviewComment")) {
      const t = state.threads.find((t) =>
        t.comments.some((c) => c.id === variables["id"]),
      );
      if (!t) {
        return body({
          data: { deletePullRequestReviewComment: null },
          errors: [{ type: "NOT_FOUND", message: "Could not resolve" }],
        });
      }
      t.comments = t.comments.filter((c) => c.id !== variables["id"]);
      state.threads = state.threads.filter((t) => t.comments.length > 0);
      const left = comments().filter((c) => c.state === "PENDING").length;
      return body({
        data: {
          deletePullRequestReviewComment: {
            pullRequestReview: {
              id: state.pending,
              state: "PENDING",
              body: "",
              comments: { totalCount: left },
            },
          },
        },
      });
    }
    if (query.includes("deletePullRequestReview(")) {
      expect(variables["id"]).toBe(state.pending);
      state.pending = undefined;
      return body({ data: { deletePullRequestReview: {} } });
    }
    for (const via of ["submitPullRequestReview", "addPullRequestReview"]) {
      if (query.includes(`${via}(`)) {
        for (const c of comments()) {
          c.state = "SUBMITTED";
        }
        state.pending = undefined;
        state.submitted.push({
          event: String(variables["event"]),
          body: String(variables["body"]),
          via,
        });
        return body({ data: { [via]: { pullRequestReview: { id: "x" } } } });
      }
    }
    throw new Error(`unexpected query: ${query}`);
  };
  return { graphql, state };
}

const reviews = (fake: ReturnType<typeof fakeGitHub>) =>
  new GitHubReviews(fake.graphql, async () => "PR_7");

describe("GitHubReviews", () => {
  it("adds line, range and file drafts to the pending review", async () => {
    const fake = fakeGitHub();
    const r = reviews(fake);
    const line = await r.addDraft(
      REF,
      { path: "src/a.ts", line: 2, side: "new" },
      "one line",
    );
    expect(line.anchor).toEqual({ path: "src/a.ts", line: 2, side: "new" });
    expect(line.comments[0]).toMatchObject({ body: "one line", pending: true });
    const range = await r.addDraft(
      REF,
      {
        path: "src/a.ts",
        startLine: 1,
        startSide: "new",
        line: 3,
        side: "new",
      },
      "a range",
    );
    expect(range.anchor).toEqual({
      path: "src/a.ts",
      line: 3,
      side: "new",
      startLine: 1,
      startSide: "new",
    });
    const file = await r.addDraft(REF, { path: "src/a.ts" }, "the file");
    expect(file.anchor).toEqual({ path: "src/a.ts" });
    const { threads } = await r.threads(REF);
    expect(threads.map((t) => t.comments[0]?.body)).toEqual([
      "one line",
      "a range",
      "the file",
    ]);
  });

  it("says when GitHub won't take a line outside the diff", async () => {
    const r = reviews(fakeGitHub());
    await expect(
      r.addDraft(REF, { path: "src/a.ts", line: 5, side: "new" }, "x"),
    ).rejects.toMatchObject({
      status: 422,
      hint: expect.stringMatching(/lines of the diff/),
    });
  });

  it("edits and deletes drafts; deleting one already gone is fine", async () => {
    const fake = fakeGitHub();
    const r = reviews(fake);
    const t = await r.addDraft(REF, { path: "src/a.ts", line: 1 }, "first");
    const id = t.comments[0]?.id ?? "";
    await r.editDraft(REF, id, "changed");
    expect((await r.threads(REF)).threads[0]?.comments[0]?.body).toBe(
      "changed",
    );
    await r.deleteDraft(REF, id);
    await r.deleteDraft(REF, id);
    expect((await r.threads(REF)).threads).toEqual([]);
    // The emptied pending review is gone too.
    expect(fake.state.pending).toBeUndefined();
  });

  it("submits the pending review, or the summary alone without one", async () => {
    const fake = fakeGitHub();
    const r = reviews(fake);
    await r.submit(REF, "approve", "LGTM");
    await r.addDraft(REF, { path: "src/a.ts", line: 10 }, "nit");
    await r.submit(REF, "request-changes", "Please fix");
    expect(fake.state.submitted).toEqual([
      { event: "APPROVE", body: "LGTM", via: "addPullRequestReview" },
      {
        event: "REQUEST_CHANGES",
        body: "Please fix",
        via: "submitPullRequestReview",
      },
    ]);
    const { threads } = await r.threads(REF);
    expect(threads[0]?.comments[0]?.pending).toBe(false);
  });

  it("shows outdated threads where they were, and whether the change is the user's", async () => {
    const fake = fakeGitHub({ author: true });
    fake.state.threads.push({
      id: "T",
      path: "src/a.ts",
      line: 4,
      startLine: null,
      side: "LEFT",
      file: false,
      outdated: true,
      comments: [{ id: "C", body: "old", state: "SUBMITTED", author: "you" }],
    });
    const { threads, ownChange } = await reviews(fake).threads(REF);
    expect(ownChange).toBe(true);
    expect(threads[0]).toMatchObject({
      outdated: true,
      anchor: { path: "src/a.ts", line: 4, side: "old" },
      comments: [{ author: "you", pending: false }],
    });
  });

  it("fails with 403 and a hint when the token may only read", async () => {
    const r = reviews(fakeGitHub({ readOnly: true }));
    const err = await r
      .addDraft(REF, { path: "src/a.ts", line: 1 }, "x")
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ForgeError);
    expect(err).toMatchObject({
      status: 403,
      hint: expect.stringMatching(/Pull requests/),
    });
  });
});
