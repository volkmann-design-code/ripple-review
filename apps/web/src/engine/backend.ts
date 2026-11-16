import type {
  ChangeRef,
  CommentAnchor,
  FileLines,
  Forgettable,
  PullRequestSummary,
  RecentChange,
  ReviewDrafts,
  ReviewEvent,
  ReviewPayload,
  SavedProgress,
  StoredData,
  Tick,
} from "@ripple-review/api-contract";
import type { AiUsage, ReviewModel } from "@ripple-review/core/ai";
import type { Forge } from "@ripple-review/core/forge";
import type { ChangeSet } from "@ripple-review/core/model";
import type { Store } from "@ripple-review/core/store";
import { GitHubForge } from "@ripple-review/forge-github";
import type { EngineApi, Settings } from "./api";
import { Changes } from "./changes";
import { anchorOf, checked, repoChecked, text } from "./checks";
import { Drafts } from "./drafts";
import { AppError } from "./errors";
import { refKey } from "./payload";
import { reviewsOn, viewedOn } from "./ports";
import { ProgressStore } from "./progress";
import { Reviews, type Stage } from "./reviews";
import { type EngineStores, forget, storedData } from "./stored";

export type { EngineApi, Settings } from "./api";

export interface BackendDeps {
  stores: EngineStores;
  fetch?: typeof fetch;
  /** GitHub with the user's token; tests replace it. */
  github?: (
    token: string,
    fetch: typeof globalThis.fetch,
    blobs: Store,
  ) => Forge;
}

const gitHubForge = (
  token: string,
  fetch: typeof globalThis.fetch,
  blobs: Store,
): Forge => new GitHubForge({ token, fetch, blobs });

/**
 * The engine behind the web app, in a Web Worker: GitHub through its API with
 * the user's token, the AI with the user's key, everything kept in the
 * user's browser (D22).
 */
export class Backend implements EngineApi {
  private settings: Settings = {};
  private forge?: Forge;
  private readonly reviews: Reviews;
  private readonly writing: Drafts;
  private readonly changes: Changes;
  private readonly fetch: typeof fetch;

  constructor(private readonly deps: BackendDeps) {
    this.fetch = deps.fetch ?? globalThis.fetch.bind(globalThis);
    this.reviews = new Reviews({
      loadChange: (ref, stage, previous) =>
        this.pullRequest(ref, stage, previous),
      progress: new ProgressStore(deps.stores.progress),
      saved: deps.stores.reviews,
      model: (ref) => {
        const key = this.settings.anthropicKey;
        return key
          ? (onUsage, onSaved) => this.model(key, ref, onUsage, onSaved)
          : undefined;
      },
      viewed: (ref) =>
        this.settings.githubToken ? viewedOn(this.github(), ref) : undefined,
    });
    this.writing = new Drafts({
      port: (ref) =>
        this.settings.githubToken ? reviewsOn(this.github(), ref) : undefined,
      store: deps.stores.drafts,
    });
    this.changes = new Changes(deps.stores.changes);
  }

  async configure(settings: Settings): Promise<void> {
    if (settings.githubToken !== this.settings.githubToken) {
      this.forge = undefined;
    }
    this.settings = { ...settings };
  }

  async review(
    ref: ChangeRef,
    ai: boolean | undefined,
    onStage: Stage,
  ): Promise<ReviewPayload> {
    const payload = await this.reviews.review(checked(ref), ai, onStage);
    await this.changes.opened(payload);
    return payload;
  }

  async fileLines(ref: ChangeRef, path: string): Promise<FileLines> {
    return this.reviews.file(checked(ref), path);
  }

  async saveProgress(ref: ChangeRef, ticks: Tick[]): Promise<SavedProgress> {
    const saved = await this.reviews.saveTicks(
      checked(ref),
      ticks.map(({ path, patchHash }) => ({ path, patchHash })),
    );
    await this.changes.ticked(ref, saved.ticks.length);
    return saved;
  }

  async recent(): Promise<RecentChange[]> {
    return this.changes.recent(12);
  }

  async stored(): Promise<StoredData> {
    return storedData(this.deps.stores);
  }

  async forget(what: Forgettable): Promise<void> {
    if (what?.kind === "change") {
      const key = refKey(checked(what.ref));
      await forget(this.deps.stores, what);
      this.reviews.forget(key);
      this.writing.forget(key);
    } else if (what?.kind === "other-ai-answers" || what?.kind === "files") {
      await forget(this.deps.stores, what);
    } else {
      throw new AppError(400, "Not something stored here");
    }
  }

  async drafts(ref: ChangeRef): Promise<ReviewDrafts | undefined> {
    return this.writing.get(checked(ref));
  }

  async addDraft(
    ref: ChangeRef,
    anchor: CommentAnchor,
    body: string,
  ): Promise<ReviewDrafts> {
    return this.writing.addDraft(checked(ref), anchorOf(anchor), text(body));
  }

  async editDraft(
    ref: ChangeRef,
    id: string,
    body: string,
  ): Promise<ReviewDrafts> {
    return this.writing.editDraft(checked(ref), String(id), text(body));
  }

  async deleteDraft(ref: ChangeRef, id: string): Promise<ReviewDrafts> {
    return this.writing.deleteDraft(checked(ref), String(id));
  }

  async saveSummary(ref: ChangeRef, body: string): Promise<void> {
    return this.writing.saveSummary(checked(ref), String(body));
  }

  async submitReview(
    ref: ChangeRef,
    event: ReviewEvent,
    body: string,
  ): Promise<ReviewDrafts> {
    if (!["comment", "approve", "request-changes"].includes(event)) {
      throw new AppError(400, "Not a way to submit a review");
    }
    return this.writing.submit(checked(ref), event, String(body));
  }

  async pulls(owner: string, repo: string): Promise<PullRequestSummary[]> {
    repoChecked(owner, repo);
    return (await this.github().listChanges(`${owner}/${repo}`)).map((c) => ({
      number: c.number,
      title: c.title,
      author: c.author ?? "",
      updatedAt: c.updatedAt ?? "",
      url: c.url,
      draft: c.draft ?? false,
      ...(c.head !== undefined ? { head: c.head } : {}),
      ...(c.base !== undefined ? { base: c.base } : {}),
      ...(c.defaultBranch !== undefined
        ? { defaultBranch: c.defaultBranch }
        : {}),
      ...(c.fromFork !== undefined ? { fromFork: c.fromFork } : {}),
    }));
  }

  private github(): Forge {
    const token = this.settings.githubToken;
    if (!token) {
      throw new AppError(
        401,
        "No GitHub token yet",
        "Add one in Settings: it stays in this browser and goes only to GitHub.",
      );
    }
    this.forge ??= (this.deps.github ?? gitHubForge)(
      token,
      this.fetch,
      this.deps.stores.blobs,
    );
    return this.forge;
  }

  private pullRequest(
    ref: ChangeRef,
    stage: Stage,
    previous?: ChangeSet,
  ): Promise<ChangeSet> {
    return this.github().loadChange(
      { repo: `${ref.owner}/${ref.repo}`, number: ref.number },
      { stage, ...(previous ? { previous } : {}) },
    );
  }

  /**
   * Claude with the user's key, answers cached in the browser and tied to
   * the change they are about. Loaded on first use.
   */
  private async model(
    apiKey: string,
    ref: ChangeRef,
    onUsage: (u: AiUsage) => void,
    onSaved: () => void,
  ): Promise<ReviewModel> {
    const { cached, modelFor } = await import("@ripple-review/engine/ai");
    const ai = this.deps.stores.ai;
    const answers: Store = {
      get: async <T>(key: string) => {
        const hit = await ai.get<T>(key);
        if (hit !== undefined) {
          await this.changes.aiAnswer(ref, key);
        }
        return hit;
      },
      put: async (key, value) => {
        await ai.put(key, value);
        await this.changes.aiAnswer(ref, key);
      },
    };
    return cached(
      modelFor(undefined, undefined, onUsage, apiKey),
      answers,
      onSaved,
    );
  }
}
