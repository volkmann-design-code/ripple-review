import {
  type CommentAnchor,
  type DiffSide,
  type ForgeChangeRef,
  ForgeError,
  type ForgeReviews,
  type ReviewEvent,
  type ReviewFeatures,
  type ReviewThread,
} from "@ripple-review/core/forge";
import { type GraphQL, graphqlError } from "./graphql.ts";

/*
 * Pull request reviews over GraphQL. Draft comments go into the user's
 * pending review (GitHub starts it with the first one), which only they see
 * until they submit it; the summary is sent with the submit (GitHub doesn't
 * keep one on a pending review).
 */

const THREAD_FIELDS = `id isResolved isOutdated path line startLine originalLine
  originalStartLine diffSide startDiffSide subjectType
  comments(first: 100) { nodes { id body state createdAt url author { login } } }`;

interface ThreadJson {
  id: string;
  isResolved: boolean;
  isOutdated: boolean;
  path: string;
  line: number | null;
  startLine: number | null;
  originalLine: number | null;
  originalStartLine: number | null;
  diffSide: "LEFT" | "RIGHT";
  startDiffSide: "LEFT" | "RIGHT" | null;
  subjectType: "LINE" | "FILE";
  comments: {
    nodes: {
      id: string;
      body: string;
      state: string;
      createdAt: string;
      url: string;
      author: { login: string } | null;
    }[];
  };
}

const EVENTS: Record<ReviewEvent, string> = {
  comment: "COMMENT",
  approve: "APPROVE",
  "request-changes": "REQUEST_CHANGES",
};

const sideOf = (s: "LEFT" | "RIGHT"): DiffSide =>
  s === "LEFT" ? "old" : "new";
const githubSide = (s: DiffSide | undefined) =>
  s === "old" ? "LEFT" : "RIGHT";

/** A thread as the forge port has it. */
export function threadOf(t: ThreadJson): ReviewThread {
  const line = t.isOutdated ? t.originalLine : t.line;
  const startLine = t.isOutdated ? t.originalStartLine : t.startLine;
  const anchor: CommentAnchor = { path: t.path };
  if (t.subjectType === "LINE" && line !== null) {
    anchor.line = line;
    anchor.side = sideOf(t.diffSide);
    if (startLine !== null && startLine !== line) {
      anchor.startLine = startLine;
      anchor.startSide = sideOf(t.startDiffSide ?? t.diffSide);
    }
  }
  return {
    id: t.id,
    anchor,
    outdated: t.isOutdated,
    resolved: t.isResolved,
    comments: t.comments.nodes.map((c) => ({
      id: c.id,
      author: c.author?.login ?? "ghost",
      body: c.body,
      createdAt: c.createdAt,
      url: c.url,
      pending: c.state === "PENDING",
    })),
  };
}

export class GitHubReviews implements ForgeReviews {
  readonly features: ReviewFeatures = {
    ranges: true,
    fileComments: true,
    events: ["comment", "approve", "request-changes"],
  };

  constructor(
    private readonly graphql: GraphQL,
    private readonly pullId: (ref: ForgeChangeRef) => Promise<string>,
  ) {}

  /** Runs a query or mutation; any error fails it. */
  private async run<T>(
    what: string,
    query: string,
    variables: Record<string, unknown>,
  ): Promise<T> {
    const body = await this.graphql<T>(query, variables);
    if (body.errors?.length || !body.data) {
      throw graphqlError(body.errors ?? [], what);
    }
    return body.data;
  }

  async threads(
    ref: ForgeChangeRef,
  ): Promise<{ threads: ReviewThread[]; ownChange: boolean }> {
    const [owner = "", name = ""] = ref.repo.split("/");
    const threads: ReviewThread[] = [];
    let ownChange = false;
    let after: string | null = null;
    for (let page = 0; page < 30; page++) {
      const data: {
        repository: {
          pullRequest: {
            viewerDidAuthor: boolean;
            reviewThreads: {
              nodes: ThreadJson[];
              pageInfo: { hasNextPage: boolean; endCursor: string | null };
            };
          } | null;
        } | null;
      } = await this.run(
        "read the review comments",
        `query($owner: String!, $name: String!, $number: Int!, $after: String) {
          repository(owner: $owner, name: $name) { pullRequest(number: $number) {
            viewerDidAuthor
            reviewThreads(first: 100, after: $after) {
              nodes { ${THREAD_FIELDS} } pageInfo { hasNextPage endCursor }
            } } } }`,
        { owner, name, number: ref.number, after },
      );
      const pull = data.repository?.pullRequest;
      if (!pull) {
        throw new ForgeError(404, "Pull request not found");
      }
      ownChange = pull.viewerDidAuthor;
      threads.push(...pull.reviewThreads.nodes.map(threadOf));
      if (!pull.reviewThreads.pageInfo.hasNextPage) {
        break;
      }
      after = pull.reviewThreads.pageInfo.endCursor;
    }
    return { threads, ownChange };
  }

  async addDraft(
    ref: ForgeChangeRef,
    anchor: CommentAnchor,
    body: string,
  ): Promise<ReviewThread> {
    const input: Record<string, unknown> = {
      pullRequestId: await this.pullId(ref),
      path: anchor.path,
      body,
    };
    if (anchor.line === undefined) {
      input["subjectType"] = "FILE";
    } else {
      input["line"] = anchor.line;
      input["side"] = githubSide(anchor.side);
      if (anchor.startLine !== undefined && anchor.startLine !== anchor.line) {
        input["startLine"] = anchor.startLine;
        input["startSide"] = githubSide(anchor.startSide ?? anchor.side);
      }
    }
    const data = await this.run<{
      addPullRequestReviewThread: { thread: ThreadJson | null } | null;
    }>(
      "add the comment",
      `mutation($input: AddPullRequestReviewThreadInput!) {
        addPullRequestReviewThread(input: $input) { thread { ${THREAD_FIELDS} } } }`,
      { input },
    );
    const thread = data.addPullRequestReviewThread?.thread;
    // GitHub answers without a thread (and without an error) when the lines
    // aren't part of the diff.
    if (!thread) {
      throw new ForgeError(
        422,
        "GitHub didn't take the comment",
        "Comments go on lines of the diff: changed lines and the few around them.",
      );
    }
    return threadOf(thread);
  }

  async editDraft(
    _ref: ForgeChangeRef,
    commentId: string,
    body: string,
  ): Promise<void> {
    await this.run(
      "change the comment",
      `mutation($id: ID!, $body: String!) {
        updatePullRequestReviewComment(input: { pullRequestReviewCommentId: $id, body: $body }) {
          pullRequestReviewComment { id } } }`,
      { id: commentId, body },
    );
  }

  async deleteDraft(_ref: ForgeChangeRef, commentId: string): Promise<void> {
    const res = await this.graphql<{
      deletePullRequestReviewComment: {
        pullRequestReview: {
          id: string;
          state: string;
          body: string;
          comments: { totalCount: number };
        } | null;
      } | null;
    }>(
      `mutation($id: ID!) { deletePullRequestReviewComment(input: { id: $id }) {
        pullRequestReview { id state body comments { totalCount } } } }`,
      { id: commentId },
    );
    const errors = (res.errors ?? []).filter((e) => e.type !== "NOT_FOUND");
    if (errors.length) {
      throw graphqlError(errors, "delete the comment");
    }
    // The last draft gone: no empty pending review left behind on GitHub.
    const review = res.data?.deletePullRequestReviewComment?.pullRequestReview;
    if (
      review?.state === "PENDING" &&
      review.comments.totalCount === 0 &&
      !review.body
    ) {
      await this.graphql(
        `mutation($id: ID!) { deletePullRequestReview(input: { pullRequestReviewId: $id }) {
          pullRequestReview { id } } }`,
        { id: review.id },
      );
    }
  }

  async submit(
    ref: ForgeChangeRef,
    event: ReviewEvent,
    body: string,
  ): Promise<void> {
    const [owner = "", name = ""] = ref.repo.split("/");
    // Only the user's own pending review is visible to them.
    const data = await this.run<{
      repository: {
        pullRequest: {
          id: string;
          reviews: { nodes: { id: string }[] };
        } | null;
      } | null;
    }>(
      "read your pending review",
      `query($owner: String!, $name: String!, $number: Int!) {
        repository(owner: $owner, name: $name) { pullRequest(number: $number) {
          id reviews(states: PENDING, first: 1) { nodes { id } } } } }`,
      { owner, name, number: ref.number },
    );
    const pull = data.repository?.pullRequest;
    if (!pull) {
      throw new ForgeError(404, "Pull request not found");
    }
    const pending = pull.reviews.nodes[0]?.id;
    if (pending) {
      await this.run(
        "submit the review",
        `mutation($id: ID!, $event: PullRequestReviewEvent!, $body: String) {
          submitPullRequestReview(input: { pullRequestReviewId: $id, event: $event, body: $body }) {
            pullRequestReview { id } } }`,
        { id: pending, event: EVENTS[event], body },
      );
    } else {
      await this.run(
        "submit the review",
        `mutation($id: ID!, $event: PullRequestReviewEvent!, $body: String) {
          addPullRequestReview(input: { pullRequestId: $id, event: $event, body: $body }) {
            pullRequestReview { id } } }`,
        { id: pull.id, event: EVENTS[event], body },
      );
    }
  }
}
