import type {
  ChangeRef,
  FileLines,
  PendingMark,
  Progress,
  ReviewPayload,
  SavedProgress,
  Tick,
  ViewedSync,
} from "@ripple-review/api-contract";
import { type AiUsage, type ReviewModel, refine } from "@ripple-review/core/ai";
import type { ViewedState } from "@ripple-review/core/forge";
import type { ChangeSet, ReviewGroup } from "@ripple-review/core/model";
import type { Store } from "@ripple-review/core/store";
// Types only: the engine itself is imported when a review is first asked for.
import type { review as reviewChange } from "@ripple-review/engine/review";
import { AppError } from "./errors";
import { currentTicks, payloadOf, refKey, versionOf } from "./payload";
import type { ProgressStore } from "./progress";
import { SAVED_REVIEWS } from "./saved-reviews";
import { Serial } from "./serial";
import { stepMessage, throttled } from "./steps";
import {
  livePending,
  marksBetween,
  notSynced,
  ticksOf,
  type ViewedPort,
  withMarks,
} from "./viewed";

/** Reports what a long request is doing, for the progress shown in the app. */
export type Stage = (message: string) => void;

type Unticked = Omit<ReviewPayload, "ticks">;
type Planned = Awaited<ReturnType<typeof reviewChange>>;
/** A review as saved on the device: the groups (the diff comes from the forge). */
interface SavedReview {
  groups: ReviewGroup[];
  ai?: Omit<NonNullable<ReviewPayload["ai"]>, "usage">;
  savedAt: string;
}
type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };

/** Progress with new ticks and the marks still to send (none: no field). */
function withTicks(
  { pending: _, ...progress }: Progress,
  ticks: Tick[],
  pending: PendingMark[],
): Progress {
  return { ...progress, ticks, ...(pending.length ? { pending } : {}) };
}

const savedKey = (key: string) => `${SAVED_REVIEWS.version}:${key}`;

const settle = <T>(p: Promise<T>): Promise<Settled<T>> =>
  p.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );

export interface ReviewsDeps {
  /** Loads a change; `previous` is its last load, to reuse when unchanged. */
  loadChange(
    ref: ChangeRef,
    stage: Stage,
    previous?: ChangeSet,
  ): Promise<ChangeSet>;
  progress: ProgressStore;
  /**
   * The AI model for a change, reporting each call's usage, or that its
   * answer was saved on the device; undefined while it is off (no key).
   */
  model(
    ref: ChangeRef,
  ):
    | ((
        onUsage: (u: AiUsage) => void,
        onSaved: () => void,
      ) => Promise<ReviewModel>)
    | undefined;
  /** Reviews computed before, by change and diff (IndexedDB); none: memory only. */
  saved?: Store;
  /** The change's "Viewed" marks on its forge, if it has them. */
  viewed?(ref: ChangeRef): ViewedPort | undefined;
}

/** Lets a stage reach the page before long synchronous work starts. */
const yieldToPage = () => new Promise((r) => setTimeout(r, 0));

/**
 * Reviews of changes, the files behind them and the reviewer's ticks, with
 * what has been loaded and computed kept in memory.
 */
export class Reviews {
  /** Reviews by change and diff version; AI ones by the same plus "+ai". */
  private readonly reviews = new Map<string, Unticked>();
  /** The last loaded change per reference. */
  private readonly changes = new Map<string, ChangeSet>();
  /** Per change: tick updates, one after another. */
  private readonly queue = new Serial();
  /** Per change: how many tick saves have finished (to spot stale marks). */
  private readonly saves = new Map<string, number>();

  constructor(private readonly deps: ReviewsDeps) {}

  /**
   * The review of a change. `wantAi`: true/false is the reviewer's choice and
   * is remembered; undefined uses the remembered one (static when the AI is off).
   */
  async review(
    ref: ChangeRef,
    wantAi: boolean | undefined,
    stage: Stage,
  ): Promise<ReviewPayload> {
    const aiAvailable = this.deps.model(ref) !== undefined;
    if (wantAi && !aiAvailable) {
      throw new AppError(
        503,
        "The AI layer is not available",
        "Add an Anthropic API key in Settings.",
      );
    }
    const key = refKey(ref);
    // The forge's marks are read while the change loads and is analysed.
    const port = this.deps.viewed?.(ref);
    const savesBefore = this.saves.get(key) ?? 0;
    const remote = port ? settle(port.get()) : undefined;
    const ai = (await this.rememberAi(key, wantAi)) && aiAvailable;
    const cs = await this.load(ref, stage);
    const version = `${key}@${versionOf(cs)}`;
    const wanted = ai ? `${version}+ai` : version;
    let payload =
      this.reviews.get(wanted) ?? (await this.restored(wanted, ref, cs, stage));
    if (!payload) {
      const planned = await this.analysed(cs, stage);
      payload = payloadOf(ref, cs, planned.groups);
      await this.keep(version, payload);
      if (ai) {
        payload = await this.refined(ref, cs, planned, stage);
        await this.keep(wanted, payload);
      }
    }
    this.reviews.set(wanted, payload);
    if (!port || !remote) {
      return { ...payload, ticks: await this.localTicks(key, payload) };
    }
    const synced = await this.queue.run(key, async () => {
      // A tick saved meanwhile may be missing from what was read: read again.
      const marks =
        (this.saves.get(key) ?? 0) === savesBefore
          ? await remote
          : await settle(port.get());
      return this.syncedTicks(key, payload, port, marks);
    });
    return { ...payload, ...synced };
  }

  /** Analyses the change, saying step by step what it is doing. */
  private async analysed(cs: ChangeSet, stage: Stage): Promise<Planned> {
    stage(
      this.engineLoaded
        ? `Analysing ${cs.files.length} files`
        : "Loading the analysis engine",
    );
    await yieldToPage();
    // The engine (and the TypeScript compiler in it) loads on first use.
    const { review } = await import("@ripple-review/engine/review");
    this.engineLoaded = true;
    const say = throttled(stage);
    return review(cs, (s) =>
      say(
        s.step,
        stepMessage(s, cs.files.length),
        s.step === "read" && s.done === s.total,
      ),
    );
  }
  private engineLoaded = false;

  /** A review saved on this device for the same diff, if there is one. */
  private async restored(
    key: string,
    ref: ChangeRef,
    cs: ChangeSet,
    stage: Stage,
  ): Promise<Unticked | undefined> {
    const saved = await this.deps.saved
      ?.get<SavedReview>(savedKey(key))
      .catch(() => undefined);
    if (!saved) {
      return undefined;
    }
    stage("Using the review saved on this device");
    return {
      ...payloadOf(ref, cs, saved.groups),
      ...(saved.ai ? { ai: saved.ai } : {}),
      restored: { savedAt: saved.savedAt },
    };
  }

  /** Keeps a review in memory and on the device. */
  private async keep(key: string, payload: Unticked): Promise<void> {
    this.reviews.set(key, payload);
    const saved: SavedReview = {
      groups: payload.groups,
      savedAt: new Date().toISOString(),
    };
    if (payload.ai) {
      // What it cost was paid once; a restored review costs nothing.
      const { usage: _, ...ai } = payload.ai;
      saved.ai = ai;
    }
    // Not being able to save it only costs the next load the analysis.
    await this.deps.saved?.put(savedKey(key), saved).catch(() => {});
  }

  /** Forgets what is kept in memory of a change (its data on the device was deleted). */
  forget(key: string): void {
    for (const k of this.reviews.keys()) {
      if (k.startsWith(`${key}@`)) {
        this.reviews.delete(k);
      }
    }
    this.changes.delete(key);
  }

  /** A changed file's lines at head (not for deleted or binary files). */
  async file(ref: ChangeRef, path: string): Promise<FileLines> {
    const cs = await this.load(ref, () => {});
    const file = cs.files.find((f) => f.path === path);
    if (!file || file.status === "removed" || file.binary) {
      throw new AppError(404, "Not a changed text file at head");
    }
    const content = await cs.head.read(path);
    if (content === undefined) {
      throw new AppError(404, "The file's content is not available");
    }
    return { path, lines: content.replace(/\n$/, "").split("\n") };
  }

  /** Stores the ticks and, where the forge has "Viewed" marks, sets them there. */
  saveTicks(ref: ChangeRef, ticks: Tick[]): Promise<SavedProgress> {
    const key = refKey(ref);
    const port = this.deps.viewed?.(ref);
    return this.queue.run(key, async () => {
      const progress = await this.deps.progress.get(key);
      if (!port) {
        return this.deps.progress.put(key, { ...progress, ticks });
      }
      let pending = withMarks(
        progress.pending ?? [],
        marksBetween(progress.ticks, ticks),
      );
      let viewedSync: ViewedSync = { forge: port.forge, synced: true };
      try {
        await port.set(pending.map(({ path, viewed }) => ({ path, viewed })));
        pending = [];
      } catch (err) {
        viewedSync = notSynced(
          port,
          `Ticks not marked as viewed on ${port.forge}`,
          err,
        );
      }
      const saved = await this.deps.progress.put(
        key,
        withTicks(progress, ticks, pending),
      );
      this.saves.set(key, (this.saves.get(key) ?? 0) + 1);
      return { ...saved, viewedSync };
    });
  }

  /** Loads a change, reusing the last load when the source says it's unchanged. */
  private async load(ref: ChangeRef, stage: Stage): Promise<ChangeSet> {
    const key = refKey(ref);
    const cs = await this.deps.loadChange(ref, stage, this.changes.get(key));
    this.changes.set(key, cs);
    return cs;
  }

  /** Stores a new AI choice; returns the one in effect. */
  private async rememberAi(
    key: string,
    wantAi: boolean | undefined,
  ): Promise<boolean> {
    const state = await this.deps.progress.get(key);
    if (wantAi !== undefined && wantAi !== (state.ai ?? false)) {
      await this.deps.progress.put(key, { ...state, ai: wantAi });
    }
    return wantAi ?? state.ai ?? false;
  }

  private async localTicks(key: string, payload: Unticked): Promise<Tick[]> {
    return currentTicks(
      (await this.deps.progress.get(key)).ticks,
      payload.files,
    );
  }

  /**
   * The forge's marks as ticks, with ticks it hasn't got yet sent again
   * (and shown either way). Unreadable marks: the ticks kept here.
   */
  private async syncedTicks(
    key: string,
    payload: Unticked,
    port: ViewedPort,
    marks: Settled<Map<string, ViewedState>>,
  ): Promise<{ ticks: Tick[]; viewedSync: ViewedSync }> {
    const progress = await this.deps.progress.get(key);
    if (!marks.ok) {
      return {
        ticks: currentTicks(progress.ticks, payload.files),
        viewedSync: notSynced(
          port,
          `Couldn't read your Viewed marks on ${port.forge}`,
          marks.error,
        ),
      };
    }
    let pending = livePending(progress.pending ?? [], payload.files);
    let viewedSync: ViewedSync = { forge: port.forge, synced: true };
    if (pending.length) {
      try {
        await port.set(pending.map(({ path, viewed }) => ({ path, viewed })));
        pending = [];
      } catch (err) {
        viewedSync = notSynced(
          port,
          `Ticks not marked as viewed on ${port.forge}`,
          err,
        );
      }
    }
    const ticks = ticksOf(marks.value, pending, payload.files);
    await this.deps.progress.put(key, withTicks(progress, ticks, pending));
    return { ticks, viewedSync };
  }

  private async refined(
    ref: ChangeRef,
    cs: ChangeSet,
    planned: Planned,
    stage: Stage,
  ): Promise<Unticked> {
    const factory = this.deps.model(ref);
    if (!factory) {
      throw new AppError(503, "The AI layer is not available");
    }
    let usage: AiUsage | undefined;
    const model = await factory(
      (u) => {
        usage = u;
      },
      () => stage("Using the AI's answer saved on this device"),
    );
    stage(
      `Asking ${model.id.split(":")[1] ?? model.id} about ${planned.groups.length} groups`,
    );
    await yieldToPage();
    const result = await refine(model, cs, planned.groups, planned.edges, {
      input: "summary",
      nodes: planned.analysis.nodes,
    });
    return {
      ...payloadOf(ref, cs, result.groups),
      ai: {
        model: model.id,
        ...(usage ? { usage } : {}),
        weakEdges: result.weakEdges,
        reads: result.reads,
      },
    };
  }
}
