import { batched } from "@ripple-review/core/batch";
import { parseUnifiedDiff } from "@ripple-review/core/diff";
import {
  type ChangeSummary,
  type Forge,
  type ForgeChangeRef,
  ForgeError,
  type ForgeReviews,
  type LoadOptions,
  type ViewedChange,
  type ViewedMarks,
  type ViewedState,
} from "@ripple-review/core/forge";
import type { ChangeSet, Snapshot } from "@ripple-review/core/model";
import { sha256Hex } from "@ripple-review/core/sha256";
import type { Store } from "@ripple-review/core/store";
import { type GraphQLBody, graphqlError } from "./graphql.ts";
import { type PrFile, patchFromFiles } from "./patch.ts";
import { GitHubReviews } from "./reviews.ts";

export { type PrFile, patchFromFiles } from "./patch.ts";

/*
 * GitHub through its API with the user's token: REST for the pull request,
 * its diff and the tree at head, GraphQL for file contents (many per
 * request), the user's "Viewed" marks and reviews. Runs anywhere `fetch` does, a
 * browser included (D22).
 */

export interface GitHubOptions {
  /** A token that can read the repositories (fine-grained: contents, pull requests). */
  token: string;
  /** REST API base; GitHub Enterprise Server: `https://<host>/api/v3`. */
  apiUrl?: string;
  /** Web base for parsing pasted URLs and building links. */
  webUrl?: string;
  fetch?: typeof fetch;
  /**
   * File contents by blob SHA: a file unchanged since an earlier load (of
   * this or another pull request) is read from here instead of the API.
   */
  blobs?: Store;
}

/** Files per GraphQL request, and requests at once. */
const BLOBS_PER_QUERY = 25;
const PARALLEL_QUERIES = 20;
/** "Viewed" marks set per GraphQL request (one aliased mutation each). */
const MARKS_PER_MUTATION = 50;

/** Link to one file in a pull request's "Files changed" tab. */
export function githubFileLink(prUrl: string, path: string): string {
  return `${prUrl}/files#diff-${sha256Hex(path)}`;
}

interface PullJson {
  title: string;
  html_url: string;
  head: { sha: string };
  base: { sha: string };
}

interface PullListJson {
  number: number;
  title: string;
  html_url: string;
  user?: { login: string } | null;
  updated_at: string;
  draft?: boolean;
  head: { ref: string; repo?: { full_name: string } | null };
  base: { ref: string; repo: { full_name: string; default_branch: string } };
}

export class GitHubForge implements Forge {
  readonly id = "github";
  readonly host: string;
  private readonly apiUrl: string;
  private readonly graphqlUrl: string;
  private readonly fetch: typeof fetch;
  /** Pull requests' GraphQL node IDs, which the "Viewed" mutations need. */
  private readonly pullIds = new Map<string, Promise<string>>();

  constructor(private readonly options: GitHubOptions) {
    this.apiUrl = (options.apiUrl ?? "https://api.github.com").replace(
      /\/$/,
      "",
    );
    this.graphqlUrl = this.apiUrl.endsWith("/api/v3")
      ? `${this.apiUrl.slice(0, -3)}graphql`
      : `${this.apiUrl}/graphql`;
    this.host = new URL(options.webUrl ?? "https://github.com").host;
    this.fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  parseChange(input: string): ForgeChangeRef | undefined {
    const s = input.trim();
    const host = this.host.replace(/\./g, "\\.");
    const m =
      new RegExp(`${host}/([\\w.-]+)/([\\w.-]+)/pull/(\\d+)`).exec(s) ??
      /^([\w.-]+)\/([\w.-]+)(?:#|\/pull\/)(\d+)$/.exec(s);
    return m?.[1] && m[2] && m[3]
      ? { repo: `${m[1]}/${m[2]}`, number: Number(m[3]) }
      : undefined;
  }

  async listChanges(repo: string): Promise<ChangeSummary[]> {
    const pulls = await this.json<PullListJson[]>(
      `/repos/${repo}/pulls?state=open&sort=updated&direction=desc&per_page=100`,
    );
    return pulls.map((p) => ({
      number: p.number,
      title: p.title,
      url: p.html_url,
      author: p.user?.login,
      updatedAt: p.updated_at,
      draft: p.draft ?? false,
      head: p.head.ref,
      base: p.base.ref,
      defaultBranch: p.base.repo.default_branch,
      fromFork: p.head.repo?.full_name !== p.base.repo.full_name,
    }));
  }

  async loadChange(
    ref: ForgeChangeRef,
    { stage = () => {}, previous }: LoadOptions = {},
  ): Promise<ChangeSet> {
    const pull = `/repos/${ref.repo}/pulls/${ref.number}`;
    stage("Reading the pull request");
    const meta = await this.json<PullJson>(pull);
    const revision = `${meta.base.sha}..${meta.head.sha}`;
    // Same base and head as last time: the diff and the files are the same.
    if (previous?.revision === revision) {
      return { ...previous, title: meta.title };
    }
    stage("Fetching the diff");
    const patch = await this.diff(pull, stage);
    return {
      title: meta.title,
      url: meta.html_url,
      fileLink: (path) => githubFileLink(meta.html_url, path),
      head: new GitHubSnapshot(
        this,
        ref.repo,
        meta.head.sha,
        this.options.blobs,
      ),
      files: parseUnifiedDiff(patch),
      patch,
      revision,
    };
  }

  /** The diff as GitHub shows it, or rebuilt from the files API when too large. */
  private async diff(pull: string, stage: (m: string) => void) {
    const res = await this.request(pull, "application/vnd.github.diff");
    if (res.ok) {
      return res.text();
    }
    // 406: more than GitHub serves as one diff (300 files or 20 000 lines).
    if (res.status !== 406) {
      throw await this.error(res);
    }
    stage("Fetching the diff file by file (too large for one request)");
    const files: PrFile[] = [];
    for (let page = 1; page <= 30; page++) {
      const batch = await this.json<PrFile[]>(
        `${pull}/files?per_page=100&page=${page}`,
      );
      files.push(...batch);
      if (batch.length < 100) {
        break;
      }
    }
    return patchFromFiles(files);
  }

  readonly viewed: ViewedMarks = {
    get: (ref) => this.viewedStates(ref),
    set: (ref, changes) => this.setViewed(ref, changes),
  };

  /** The user's "Viewed" mark per file, 100 files per request. */
  private async viewedStates(
    ref: ForgeChangeRef,
  ): Promise<Map<string, ViewedState>> {
    const [owner = "", name = ""] = ref.repo.split("/");
    const out = new Map<string, ViewedState>();
    let after: string | null = null;
    for (let page = 0; page < 30; page++) {
      const data: {
        repository: {
          pullRequest: {
            id: string;
            files: {
              nodes: { path: string; viewerViewedState: string }[];
              pageInfo: { hasNextPage: boolean; endCursor: string | null };
            } | null;
          } | null;
        } | null;
      } = await this.graphql(
        `query($owner: String!, $name: String!, $number: Int!, $after: String) {
          repository(owner: $owner, name: $name) { pullRequest(number: $number) {
            id files(first: 100, after: $after) {
              nodes { path viewerViewedState } pageInfo { hasNextPage endCursor }
            } } } }`,
        { owner, name, number: ref.number, after },
      );
      const pull = data.repository?.pullRequest;
      if (!pull) {
        throw new ForgeError(404, "Pull request not found");
      }
      this.pullIds.set(pullKey(ref), Promise.resolve(pull.id));
      for (const f of pull.files?.nodes ?? []) {
        out.set(
          f.path,
          f.viewerViewedState === "VIEWED"
            ? "viewed"
            : f.viewerViewedState === "DISMISSED"
              ? "dismissed"
              : "unviewed",
        );
      }
      if (!pull.files?.pageInfo.hasNextPage) {
        break;
      }
      after = pull.files.pageInfo.endCursor;
    }
    return out;
  }

  /** Marks or unmarks files, many per request (aliased mutations). */
  private async setViewed(
    ref: ForgeChangeRef,
    changes: ViewedChange[],
  ): Promise<void> {
    if (!changes.length) {
      return;
    }
    const id = await this.pullId(ref);
    for (let i = 0; i < changes.length; i += MARKS_PER_MUTATION) {
      const chunk = changes.slice(i, i + MARKS_PER_MUTATION);
      const vars = chunk.map((_, j) => `$p${j}: String!`).join(", ");
      const fields = chunk
        .map(
          (c, j) =>
            `m${j}: ${c.viewed ? "markFileAsViewed" : "unmarkFileAsViewed"}(input: { pullRequestId: $id, path: $p${j} }) { clientMutationId }`,
        )
        .join(" ");
      const variables: Record<string, unknown> = { id };
      for (const [j, c] of chunk.entries()) {
        variables[`p${j}`] = c.path;
      }
      const { errors = [] } = await this.graphqlBody(
        `mutation($id: ID!, ${vars}) { ${fields} }`,
        variables,
      );
      // A path no longer in the pull request (UNPROCESSABLE) fails only its
      // own mutation; anything else means the marks weren't set.
      const failed = errors.filter((e) => e.type !== "UNPROCESSABLE");
      if (failed.length) {
        throw graphqlError(failed, "set the Viewed marks");
      }
    }
  }

  readonly reviews: ForgeReviews = new GitHubReviews(
    (query, variables) => this.graphqlBody(query, variables),
    (ref) => this.pullId(ref),
  );

  private pullId(ref: ForgeChangeRef): Promise<string> {
    const key = pullKey(ref);
    let id = this.pullIds.get(key);
    if (!id) {
      const [owner = "", name = ""] = ref.repo.split("/");
      id = this.graphql<{
        repository: { pullRequest: { id: string } | null } | null;
      }>(
        "query($owner: String!, $name: String!, $number: Int!) { repository(owner: $owner, name: $name) { pullRequest(number: $number) { id } } }",
        { owner, name, number: ref.number },
      ).then((d) => {
        const pull = d.repository?.pullRequest;
        if (!pull) {
          throw new ForgeError(404, "Pull request not found");
        }
        return pull.id;
      });
      id.catch(() => this.pullIds.delete(key));
      this.pullIds.set(key, id);
    }
    return id;
  }

  /** Every file of the tree at `sha`, with its blob SHA. */
  async tree(repo: string, sha: string): Promise<Map<string, string>> {
    const tree = await this.json<{
      tree: { path: string; type: string; sha: string }[];
    }>(`/repos/${repo}/git/trees/${sha}?recursive=1`);
    return new Map(
      tree.tree.filter((e) => e.type === "blob").map((e) => [e.path, e.sha]),
    );
  }

  /** The text of files at `sha`; binary or missing files are left out. */
  async blobs(
    repo: string,
    sha: string,
    paths: string[],
  ): Promise<Map<string, string>> {
    const [owner, name] = repo.split("/");
    const chunks: string[][] = [];
    for (let i = 0; i < paths.length; i += BLOBS_PER_QUERY) {
      chunks.push(paths.slice(i, i + BLOBS_PER_QUERY));
    }
    const out = new Map<string, string>();
    const query = async (chunk: string[]) => {
      const vars = chunk.map((_, j) => `$e${j}: String!`).join(", ");
      const fields = chunk
        .map(
          (_, j) =>
            `f${j}: object(expression: $e${j}) { ... on Blob { text } }`,
        )
        .join(" ");
      const variables: Record<string, string> = {
        owner: owner ?? "",
        name: name ?? "",
      };
      for (const [j, p] of chunk.entries()) {
        variables[`e${j}`] = `${sha}:${p}`;
      }
      const data = await this.graphql<{
        repository: Record<string, { text?: string | null } | null>;
      }>(
        `query($owner: String!, $name: String!, ${vars}) { repository(owner: $owner, name: $name) { ${fields} } }`,
        variables,
      );
      for (const [j, p] of chunk.entries()) {
        const text = data.repository[`f${j}`]?.text;
        if (typeof text === "string") {
          out.set(p, text);
        }
      }
    };
    // A pool: each slot takes the next chunk as soon as its query is done.
    let next = 0;
    const slot = async () => {
      while (next < chunks.length) {
        const chunk = chunks[next++];
        if (chunk) {
          await query(chunk);
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(PARALLEL_QUERIES, chunks.length) }, slot),
    );
    return out;
  }

  private request(path: string, accept = "application/vnd.github+json") {
    return this.fetch(`${this.apiUrl}${path}`, {
      headers: {
        Accept: accept,
        Authorization: `Bearer ${this.options.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  }

  private async json<T>(path: string): Promise<T> {
    const res = await this.request(path);
    if (!res.ok) {
      throw await this.error(res);
    }
    return (await res.json()) as T;
  }

  private async graphql<T>(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<T> {
    const body = await this.graphqlBody<T>(query, variables);
    if (!body.data) {
      throw graphqlError(body.errors ?? [], "answer");
    }
    return body.data;
  }

  /** The whole answer: data, and errors, which may come with partial data. */
  private async graphqlBody<T>(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<GraphQLBody<T>> {
    const res = await this.fetch(this.graphqlUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) {
      throw await this.error(res);
    }
    return (await res.json()) as GraphQLBody<T>;
  }

  private async error(res: Response): Promise<ForgeError> {
    const text = await res.text().catch(() => "");
    let message = text;
    try {
      message = (JSON.parse(text) as { message?: string }).message ?? text;
    } catch {
      /* not JSON */
    }
    if (res.status === 401) {
      return new ForgeError(
        401,
        "GitHub rejected the token",
        "Check that the token is valid and not expired.",
      );
    }
    if (
      res.status === 403 &&
      (res.headers.get("x-ratelimit-remaining") === "0" ||
        /rate limit/i.test(message))
    ) {
      return new ForgeError(429, "GitHub's API rate limit is used up", message);
    }
    if (res.status === 404) {
      return new ForgeError(
        404,
        "Pull request or repository not found",
        "Check the name, and that the token can read the repository.",
      );
    }
    return new ForgeError(
      502,
      `GitHub answered ${res.status}${message ? `: ${message}` : ""}`,
    );
  }
}

const pullKey = (ref: ForgeChangeRef) => `${ref.repo}#${ref.number}`;

/**
 * The tree at one commit, listed once; files read in batches through
 * GraphQL, or from the blob cache when their content is known.
 */
class GitHubSnapshot implements Snapshot {
  private files?: Promise<Map<string, string>>;
  private readonly readBatched = batched((paths) => this.load(paths));

  constructor(
    private readonly forge: GitHubForge,
    private readonly repo: string,
    private readonly sha: string,
    private readonly cache?: Store,
  ) {}

  /** Path → blob SHA. */
  private tree(): Promise<Map<string, string>> {
    this.files ??= this.forge.tree(this.repo, this.sha);
    return this.files;
  }

  async list(): Promise<readonly string[]> {
    return [...(await this.tree()).keys()];
  }

  async read(path: string): Promise<string | undefined> {
    return (await this.tree()).has(path) ? this.readBatched(path) : undefined;
  }

  private async load(paths: string[]): Promise<Map<string, string>> {
    const cache = this.cache;
    if (!cache) {
      return this.forge.blobs(this.repo, this.sha, paths);
    }
    const tree = await this.tree();
    const out = new Map<string, string>();
    const cached = await Promise.all(
      paths.map((p) => {
        const blob = tree.get(p);
        return blob ? cache.get<string>(blob) : undefined;
      }),
    );
    const missing: string[] = [];
    for (const [i, p] of paths.entries()) {
      const text = cached[i];
      if (typeof text === "string") {
        out.set(p, text);
      } else {
        missing.push(p);
      }
    }
    if (missing.length) {
      const fetched = await this.forge.blobs(this.repo, this.sha, missing);
      await Promise.all(
        [...fetched].map(([p, text]) => {
          out.set(p, text);
          const blob = tree.get(p);
          return blob ? cache.put(blob, text) : undefined;
        }),
      );
    }
    return out;
  }
}
