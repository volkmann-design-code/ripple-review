import { join } from "node:path";
import type { ChangeRef, ReviewPayload } from "@ripple-review/api-contract";
import { type AiUsage, fakeModel } from "@ripple-review/core/ai";
import { type Forge, ForgeError } from "@ripple-review/core/forge";
import { MemoryStore } from "@ripple-review/core/store";
import { loadFixture } from "@ripple-review/sources/fixture";
import { describe, expect, it, vi } from "vitest";
import { Backend } from "./backend";
import type { EngineStores } from "./stored";

const FIXTURE = join(import.meta.dirname, "../../../cli/fixtures/hono-5556");
const REF: ChangeRef = {
  kind: "github",
  owner: "honojs",
  repo: "hono",
  number: 5556,
};

const memoryStores = (): EngineStores & Record<string, MemoryStore> => ({
  ai: new MemoryStore(),
  progress: new MemoryStore(),
  blobs: new MemoryStore(),
  reviews: new MemoryStore(),
  drafts: new MemoryStore(),
  changes: new MemoryStore(),
});

/** A forge that serves the recorded pull request #5556, and nothing else. */
const recorded = (): Forge => ({
  id: "github",
  host: "github.com",
  parseChange: () => undefined,
  listChanges: async () => [],
  loadChange: async (ref, options) => {
    if (ref.number !== 5556) {
      throw new ForgeError(404, "Pull request or repository not found");
    }
    options?.stage?.("Loading the pull request");
    return loadFixture(FIXTURE);
  },
});

/**
 * The engine with a token, on the recorded pull request (or, with `fetch`,
 * on GitHub's API answered by it), with stores in memory.
 */
function backend(fetchOverride?: typeof fetch, stores = memoryStores()) {
  const fetched: string[] = [];
  const fetch = (async (input: string | URL) => {
    fetched.push(String(input));
    return new Response(JSON.stringify({ message: "Not Found" }), {
      status: 404,
    });
  }) as typeof globalThis.fetch;
  const b = new Backend({
    stores,
    fetch: fetchOverride ?? fetch,
    ...(fetchOverride ? {} : { github: recorded }),
  });
  void b.configure({ githubToken: "t" });
  return { backend: b, stores, fetched };
}

const usage: AiUsage = {
  model: "fake-model",
  inputTokens: 10,
  outputTokens: 5,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  turns: 1,
  notes: [],
};

/** Replaces the Anthropic model with one that names group 2. */
function fakeAi() {
  const calls = vi.fn();
  vi.doMock("@ripple-review/engine/ai", async (original) => {
    const real = await original<typeof import("@ripple-review/engine/ai")>();
    return {
      ...real,
      modelFor: (
        _spec: unknown,
        _effort: unknown,
        onUsage?: (u: AiUsage) => void,
      ) => {
        const m = fakeModel({
          order: [],
          groups: [{ id: 2, title: "Vitest setup", purpose: "Adds Vitest." }],
          moves: [],
          weakEdges: [],
        });
        return {
          id: "anthropic:fake-model:medium",
          complete(request: Parameters<typeof m.complete>[0]) {
            calls();
            onUsage?.(usage);
            return m.complete(request);
          },
        };
      },
    };
  });
  return calls;
}

describe("Backend", () => {
  it("reviews a pull request: every file once, with its diff and link", async () => {
    const { backend: b } = backend();
    const stages: string[] = [];
    const r = await b.review(REF, undefined, (s) => stages.push(s));
    expect(r.title).toBe(
      "fix(reg-exp-router): correct wildcard middleware coverage",
    );
    const placed = r.groups.flatMap((g) => g.items.map((i) => i.path));
    expect(placed.sort()).toEqual(Object.keys(r.files).sort());
    expect(new Set(placed).size).toBe(placed.length);
    expect(
      r.files["src/router/reg-exp-router/router.ts"]?.hunks.length,
    ).toBeGreaterThan(0);
    expect(r.files["src/router/reg-exp-router/router.ts"]?.link).toMatch(
      /\/pull\/5556\/files#diff-/,
    );
    expect(r.ai).toBeUndefined();
    expect(r.ticks).toEqual([]);
    expect(stages[0]).toBe("Loading the pull request");
    expect(stages).toContain("Linking the changed files");
    expect(stages.at(-1)).toMatch(/^Ordering \d+ files into groups$/);
    expect(
      stages.filter((s) => s.startsWith("Reading the changed files")).at(-1),
    ).toMatch(/: (\d+) of \1$/);
  });

  it("uses the review saved on this device while the diff is the same", async () => {
    const { backend: first, stores } = backend();
    const computed = await first.review(REF, undefined, () => {});
    expect(computed.restored).toBeUndefined();

    // A reload: a new worker, the same stores.
    const stages: string[] = [];
    const again = await backend(undefined, stores).backend.review(
      REF,
      undefined,
      (s) => stages.push(s),
    );
    expect(stages).toEqual([
      "Loading the pull request",
      "Using the review saved on this device",
    ]);
    expect(again.restored?.savedAt).toMatch(/^\d{4}-/);
    expect(again.groups).toEqual(computed.groups);
    expect(again.files).toEqual(computed.files);
  });

  it("serves a changed file's lines at head", async () => {
    const { lines } = await backend().backend.fileLines(
      REF,
      "src/router/reg-exp-router/router.ts",
    );
    expect(lines.length).toBeGreaterThan(10);
  });

  it("asks for a GitHub token before calling GitHub", async () => {
    const { backend: b, fetched } = backend();
    await b.configure({});
    const ref = {
      kind: "github",
      owner: "acme",
      repo: "app",
      number: 12,
    } as const;
    await expect(b.review(ref, undefined, () => {})).rejects.toMatchObject({
      status: 401,
      hint: expect.stringContaining("Settings"),
    });
    await expect(b.pulls("acme", "app")).rejects.toMatchObject({ status: 401 });
    expect(fetched).toEqual([]);
  });

  it("calls GitHub with the token once it is configured, passing its errors on", async () => {
    const seen: string[] = [];
    const { backend: b } = backend((async (
      input: string | URL,
      init?: RequestInit,
    ) => {
      const headers = init?.headers as Record<string, string> | undefined;
      seen.push(`${String(input)} ${headers?.["Authorization"]}`);
      return new Response(JSON.stringify({ message: "Not Found" }), {
        status: 404,
      });
    }) as typeof fetch);
    await b.configure({ githubToken: "t0ken" });
    await expect(
      b.review(
        { kind: "github", owner: "acme", repo: "app", number: 12 },
        undefined,
        () => {},
      ),
    ).rejects.toMatchObject({
      status: 404,
      message: "Pull request or repository not found",
    });
    // The pull request, and its Viewed marks (read meanwhile), with the token.
    expect(seen.sort()).toEqual([
      "https://api.github.com/graphql Bearer t0ken",
      "https://api.github.com/repos/acme/app/pulls/12 Bearer t0ken",
    ]);
  });

  it("rejects malformed references", async () => {
    const { backend: b, fetched } = backend();
    await expect(
      b.review({ ...REF, repo: "../x" }, undefined, () => {}),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      b.review({ ...REF, number: 0 }, undefined, () => {}),
    ).rejects.toMatchObject({ status: 400 });
    await expect(b.pulls("acme", "a/b")).rejects.toMatchObject({ status: 400 });
    expect(fetched).toEqual([]);
  });
});

describe("ticks", () => {
  it("are kept, and a tick drops once the file's diff changes", async () => {
    const { backend: b, stores } = backend();
    const first = await b.review(REF, undefined, () => {});
    const tick = (path: string) => ({
      path,
      patchHash: first.files[path]?.patchHash ?? "",
    });
    const saved = await b.saveProgress(REF, [
      tick("src/router/reg-exp-router/router.ts"),
      { ...tick("README.md"), patchHash: "an older diff" },
    ]);
    expect(saved.ticks).toHaveLength(2);
    expect((await b.review(REF, undefined, () => {})).ticks).toEqual([
      tick("src/router/reg-exp-router/router.ts"),
    ]);
    // Kept in the store, so a new worker (a reload) sees them too.
    const again = backend(undefined, stores).backend;
    expect((await again.review(REF, undefined, () => {})).ticks).toHaveLength(
      1,
    );
  });
});

describe("the AI", () => {
  it("is unavailable without a key, and says where to add one", async () => {
    await expect(
      backend().backend.review(REF, true, () => {}),
    ).rejects.toMatchObject({
      status: 503,
      hint: expect.stringContaining("Settings"),
    });
  });

  it("refines the order with the user's key, caches the answer, and remembers the choice", async () => {
    const calls = fakeAi();
    const { backend: b, stores } = backend();
    await b.configure({ githubToken: "t", anthropicKey: "sk-test" });
    const refined = await b.review(REF, true, () => {});
    expect(refined.groups.map((g) => g.title)).toContain("Vitest setup");
    expect(refined.ai?.model).toBe("anthropic:fake-model:medium");
    expect(refined.ai?.usage?.inputTokens).toBe(10);

    // A reload keeps the refined order; the answer comes from the store.
    const fresh = backend(undefined, stores).backend;
    await fresh.configure({ githubToken: "t", anthropicKey: "sk-test" });
    const reloaded: ReviewPayload = await fresh.review(
      REF,
      undefined,
      () => {},
    );
    expect(reloaded.ai?.model).toBe("anthropic:fake-model:medium");
    expect(reloaded.ai?.usage).toBeUndefined();
    expect(reloaded.restored).toBeDefined();
    expect(calls).toHaveBeenCalledTimes(1);

    // Saved reviews gone, the AI's answer still saved: no new call either.
    const stages: string[] = [];
    const noReviews = backend(undefined, {
      ...stores,
      reviews: new MemoryStore(),
    }).backend;
    await noReviews.configure({ githubToken: "t", anthropicKey: "sk-test" });
    const reasked = await noReviews.review(REF, true, (s) => stages.push(s));
    expect(reasked.groups.map((g) => g.title)).toContain("Vitest setup");
    expect(stages).toContain("Using the AI's answer saved on this device");
    expect(calls).toHaveBeenCalledTimes(1);

    // "Static order" is remembered too; without a key the static order shows.
    expect((await fresh.review(REF, false, () => {})).ai).toBeUndefined();
    expect((await fresh.review(REF, undefined, () => {})).ai).toBeUndefined();
    await b.review(REF, true, () => {});
    await b.configure({ githubToken: "t" });
    expect((await b.review(REF, undefined, () => {})).ai).toBeUndefined();
    vi.doUnmock("@ripple-review/engine/ai");
  });
});

describe("reviews", () => {
  const PR = {
    kind: "github",
    owner: "o",
    repo: "r",
    number: 1,
  } as const;

  it("offers none on a forge without reviews, or without a GitHub token", async () => {
    const { backend: b } = backend();
    expect(await b.drafts(REF)).toBeUndefined();
    await b.configure({});
    expect(await b.drafts(PR)).toBeUndefined();
  });

  it("refuses comments without text or a place on the diff", async () => {
    const { backend: b } = backend();
    await b.configure({ githubToken: "t" });
    await expect(
      b.addDraft(PR, { path: "a.ts", line: 1, side: "new" }, "  "),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      b.addDraft(PR, { path: "a.ts", line: 0, side: "new" }, "x"),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      b.addDraft(PR, { path: "a.ts", startLine: 2 } as never, "x"),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      b.submitReview(PR, "merge" as never, "x"),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("what is kept in this browser", () => {
  it("lists the changes opened, most recent first, with their ticks", async () => {
    const { backend: b } = backend();
    expect(await b.recent()).toEqual([]);
    const r = await b.review(REF, undefined, () => {});
    const file = "src/router/reg-exp-router/router.ts";
    await b.saveProgress(REF, [
      { path: file, patchHash: r.files[file]?.patchHash ?? "" },
    ]);
    expect(await b.recent()).toEqual([
      {
        ref: REF,
        title: "fix(reg-exp-router): correct wildcard middleware coverage",
        url: r.url,
        openedAt: expect.stringMatching(/^\d{4}-/),
        files: Object.keys(r.files).length,
        ticked: 1,
      },
    ]);
  });

  it("groups it by change, and deletes a change's data with its AI answers", async () => {
    fakeAi();
    const { backend: b, stores } = backend();
    await b.configure({ githubToken: "t", anthropicKey: "sk-test" });
    await b.review(REF, true, () => {});
    await stores.ai.put("an older answer", { order: [] });
    await stores.blobs.put("sha1", "file contents");

    const kept = await b.stored();
    expect(kept.changes).toEqual([
      expect.objectContaining({
        ref: REF,
        title: "fix(reg-exp-router): correct wildcard middleware coverage",
        // Static and AI-refined.
        reviews: 2,
        aiAnswers: 1,
        waitingDrafts: 0,
        summary: false,
      }),
    ]);
    expect(kept.otherAiAnswers.count).toBe(1);
    // The JSON of "file contents".
    expect(kept.files).toEqual({ count: 1, size: 15 });

    await b.forget({ kind: "change", ref: REF });
    const after = await b.stored();
    expect(after.changes).toEqual([]);
    expect(after.otherAiAnswers.count).toBe(1);
    expect(await b.recent()).toEqual([]);
    // Analysed again, not restored from memory or the device.
    const stages: string[] = [];
    await b.review(REF, false, (s) => stages.push(s));
    expect(stages).not.toContain("Using the review saved on this device");

    await b.forget({ kind: "other-ai-answers" });
    await b.forget({ kind: "files" });
    const rest = await b.stored();
    expect(rest.otherAiAnswers.count).toBe(0);
    expect(rest.files.count).toBe(0);
    await expect(b.forget({ kind: "x" } as never)).rejects.toMatchObject({
      status: 400,
    });
    vi.doUnmock("@ripple-review/engine/ai");
  });
});
