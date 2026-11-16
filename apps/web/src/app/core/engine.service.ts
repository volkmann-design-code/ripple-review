import { Injectable, inject } from "@angular/core";
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
import type { EngineApi, Settings } from "../../engine/api";
import type { Args, Method, Reply, Result } from "../../engine/protocol";
import { ApiFailure } from "./api-failure";
import { SettingsService } from "./settings.service";

export { ApiFailure } from "./api-failure";

interface Call {
  resolve: (v: unknown) => void;
  reject: (e: ApiFailure) => void;
  onStage?: (stage: string) => void;
}

/**
 * The engine, run in a Web Worker started on first use (so the start page
 * loads without it). Failures are `ApiFailure`s with a hint.
 */
@Injectable({ providedIn: "root" })
export class EngineService implements Omit<EngineApi, "configure"> {
  private readonly settings = inject(SettingsService);
  private worker?: Worker;
  private nextId = 0;
  private readonly calls = new Map<number, Call>();
  /** The settings the worker has; sent again when they change. */
  private sent?: Settings;

  review(
    ref: ChangeRef,
    ai: boolean | undefined,
    onStage: (stage: string) => void,
  ): Promise<ReviewPayload> {
    return this.call("review", [ref, ai], onStage);
  }

  fileLines(ref: ChangeRef, path: string): Promise<FileLines> {
    return this.call("fileLines", [ref, path]);
  }

  saveProgress(ref: ChangeRef, ticks: Tick[]): Promise<SavedProgress> {
    return this.call("saveProgress", [ref, ticks]);
  }

  drafts(ref: ChangeRef): Promise<ReviewDrafts | undefined> {
    return this.call("drafts", [ref]);
  }

  addDraft(
    ref: ChangeRef,
    anchor: CommentAnchor,
    body: string,
  ): Promise<ReviewDrafts> {
    return this.call("addDraft", [ref, anchor, body]);
  }

  editDraft(ref: ChangeRef, id: string, body: string): Promise<ReviewDrafts> {
    return this.call("editDraft", [ref, id, body]);
  }

  deleteDraft(ref: ChangeRef, id: string): Promise<ReviewDrafts> {
    return this.call("deleteDraft", [ref, id]);
  }

  saveSummary(ref: ChangeRef, body: string): Promise<void> {
    return this.call("saveSummary", [ref, body]);
  }

  submitReview(
    ref: ChangeRef,
    event: ReviewEvent,
    body: string,
  ): Promise<ReviewDrafts> {
    return this.call("submitReview", [ref, event, body]);
  }

  pulls(owner: string, repo: string): Promise<PullRequestSummary[]> {
    return this.call("pulls", [owner, repo]);
  }

  recent(): Promise<RecentChange[]> {
    return this.call("recent", []);
  }

  stored(): Promise<StoredData> {
    return this.call("stored", []);
  }

  forget(what: Forgettable): Promise<void> {
    return this.call("forget", [what]);
  }

  private call<M extends Method>(
    method: M,
    args: Args<M>,
    onStage?: (stage: string) => void,
  ): Promise<Result<M>> {
    const worker = this.start();
    const settings = this.settings.current();
    if (settings !== this.sent) {
      // Messages are handled in order: the call after this sees the settings.
      this.sent = settings;
      void this.post(worker, "configure", [settings]);
    }
    return this.post(worker, method, args, onStage);
  }

  private post<M extends Method>(
    worker: Worker,
    method: M,
    args: Args<M>,
    onStage?: (stage: string) => void,
  ): Promise<Result<M>> {
    const id = ++this.nextId;
    return new Promise<Result<M>>((resolve, reject) => {
      this.calls.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        ...(onStage ? { onStage } : {}),
      });
      worker.postMessage({ id, method, args });
    });
  }

  private start(): Worker {
    if (!this.worker) {
      const worker = new Worker(
        new URL("../../engine/engine.worker", import.meta.url),
        { type: "module" },
      );
      worker.addEventListener("message", (e: MessageEvent<Reply>) =>
        this.receive(e.data),
      );
      worker.addEventListener("error", (e) => this.crashed(e.message));
      this.worker = worker;
    }
    return this.worker;
  }

  private receive(reply: Reply): void {
    const call = this.calls.get(reply.id);
    if (!call) {
      return;
    }
    if ("stage" in reply) {
      call.onStage?.(reply.stage);
      return;
    }
    this.calls.delete(reply.id);
    if ("result" in reply) {
      call.resolve(reply.result);
    } else {
      const f = reply.failure;
      call.reject(new ApiFailure(f.error, f.hint, f.status));
    }
  }

  /** The worker failed to start or died: every open call fails, the next starts a new one. */
  private crashed(message: string): void {
    this.worker?.terminate();
    this.worker = undefined;
    this.sent = undefined;
    for (const call of this.calls.values()) {
      call.reject(
        new ApiFailure(
          "The review engine stopped",
          message || "Reload the page to try again.",
          500,
        ),
      );
    }
    this.calls.clear();
  }
}
