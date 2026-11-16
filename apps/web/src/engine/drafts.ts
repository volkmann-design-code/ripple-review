import type {
  ChangeRef,
  CommentAnchor,
  DraftComment,
  ForgeSync,
  ReviewDrafts,
  ReviewEvent,
  ReviewThread,
} from "@ripple-review/api-contract";
import { ForgeError, type ReviewFeatures } from "@ripple-review/core/forge";
import type { Store } from "@ripple-review/core/store";
import { AppError, failureOf } from "./errors";
import { refKey } from "./payload";
import { Serial } from "./serial";

/*
 * The reviewer's review on the forge: draft comments go straight into their
 * pending review there. What the forge doesn't take (a token that may only
 * read, the forge unreachable) waits in the browser and is sent on the next
 * load, like the ticks; the summary stays in the browser until submitted.
 */

/** One change's reviews on its forge. */
export interface ReviewPort {
  /** The forge's name for the user, e.g. "GitHub". */
  forge: string;
  features: ReviewFeatures;
  threads(): Promise<{ threads: ReviewThread[]; ownChange: boolean }>;
  addDraft(anchor: CommentAnchor, body: string): Promise<ReviewThread>;
  editDraft(commentId: string, body: string): Promise<void>;
  deleteDraft(commentId: string): Promise<void>;
  submit(event: ReviewEvent, body: string): Promise<void>;
}

/** A change to the pending review the forge hasn't got yet. */
export type DraftOp =
  | { op: "add"; id: string; anchor: CommentAnchor; body: string }
  | { op: "edit"; id: string; body: string }
  | { op: "delete"; id: string };

/** What is kept in the browser per change. */
export interface KeptDrafts {
  summary?: string;
  ops?: DraftOp[];
}

interface Remote {
  threads: ReviewThread[];
  ownChange: boolean;
}

const LOCAL = "local:";
const isLocal = (id: string) => id.startsWith(LOCAL);

/** The review as the page shows it: the forge's threads with the waiting changes on top. */
export function draftsView(
  port: Pick<ReviewPort, "forge" | "features">,
  remote: Remote,
  kept: KeptDrafts,
  sync: ForgeSync,
): ReviewDrafts {
  const threads: ReviewThread[] = [];
  let drafts: DraftComment[] = [];
  for (const t of remote.threads) {
    const first = t.comments[0];
    if (first?.pending) {
      drafts.push({ id: first.id, anchor: t.anchor, body: first.body });
    } else {
      threads.push(t);
    }
  }
  for (const op of kept.ops ?? []) {
    if (op.op === "add") {
      drafts.push({ id: op.id, anchor: op.anchor, body: op.body, local: true });
    } else if (op.op === "edit") {
      drafts = drafts.map((d) =>
        d.id === op.id ? { ...d, body: op.body } : d,
      );
    } else {
      drafts = drafts.filter((d) => d.id !== op.id);
    }
  }
  return {
    forge: port.forge,
    ranges: port.features.ranges,
    fileComments: port.features.fileComments,
    // GitHub doesn't let authors approve or request changes on their own change.
    events: remote.ownChange
      ? port.features.events.filter((e) => e === "comment")
      : [...port.features.events],
    threads,
    drafts,
    summary: kept.summary ?? "",
    sync,
  };
}

/** Whether a failed write is worth keeping and sending again (not a refusal of the comment itself). */
const retriable = (err: unknown) =>
  !(err instanceof ForgeError && (err.status === 422 || err.status === 404));

export class Drafts {
  private readonly queue = new Serial();
  /** The forge's threads as last read or written, per change. */
  private readonly remote = new Map<string, Remote>();

  constructor(
    private readonly deps: {
      port(ref: ChangeRef): ReviewPort | undefined;
      /** Waiting changes and the summary, per change (IndexedDB). */
      store: Store;
    },
  ) {}

  /** The review and the threads; undefined when the forge has no reviews. */
  async get(ref: ChangeRef): Promise<ReviewDrafts | undefined> {
    const port = this.deps.port(ref);
    if (!port) {
      return undefined;
    }
    const key = refKey(ref);
    return this.queue.run(key, async () => {
      let kept = await this.kept(key);
      let sync: ForgeSync = { forge: port.forge, synced: true };
      try {
        this.remote.set(key, await port.threads());
      } catch (err) {
        sync = notSynced(port, "Couldn't read the review comments", err);
        return this.view(port, key, kept, sync);
      }
      if (kept.ops?.length) {
        ({ kept, sync } = await this.flush(port, key, kept));
        this.remote.set(
          key,
          await port.threads().catch(() => this.remoteOf(key)),
        );
      }
      return this.view(port, key, kept, sync);
    });
  }

  addDraft(
    ref: ChangeRef,
    anchor: CommentAnchor,
    body: string,
  ): Promise<ReviewDrafts> {
    return this.write(ref, async (port, key, kept) => {
      try {
        const thread = await port.addDraft(anchor, body);
        const remote = this.remoteOf(key);
        this.remote.set(key, {
          ...remote,
          threads: [...remote.threads, thread],
        });
        return { kept };
      } catch (err) {
        if (!retriable(err)) {
          throw err;
        }
        const op: DraftOp = {
          op: "add",
          id: `${LOCAL}${crypto.randomUUID()}`,
          anchor,
          body,
        };
        return { kept: { ...kept, ops: [...(kept.ops ?? []), op] }, err };
      }
    });
  }

  editDraft(ref: ChangeRef, id: string, body: string): Promise<ReviewDrafts> {
    return this.write(ref, async (port, key, kept) => {
      if (isLocal(id)) {
        return {
          kept: withOps(kept, (ops) =>
            ops.map((o) =>
              o.op === "add" && o.id === id ? { ...o, body } : o,
            ),
          ),
        };
      }
      try {
        await port.editDraft(id, body);
        this.editRemote(key, id, (c) => ({ ...c, body }));
        return {
          kept: withOps(kept, (ops) =>
            ops.filter((o) => !(o.op === "edit" && o.id === id)),
          ),
        };
      } catch (err) {
        if (!retriable(err)) {
          throw err;
        }
        return {
          kept: withOps(kept, (ops) => [
            ...ops.filter((o) => !(o.op === "edit" && o.id === id)),
            { op: "edit", id, body },
          ]),
          err,
        };
      }
    });
  }

  deleteDraft(ref: ChangeRef, id: string): Promise<ReviewDrafts> {
    return this.write(ref, async (port, key, kept) => {
      // Changes still waiting for this comment are moot.
      const without = withOps(kept, (ops) => ops.filter((o) => o.id !== id));
      if (isLocal(id)) {
        return { kept: without };
      }
      try {
        await port.deleteDraft(id);
        const remote = this.remoteOf(key);
        this.remote.set(key, {
          ...remote,
          threads: remote.threads.filter((t) => t.comments[0]?.id !== id),
        });
        return { kept: without };
      } catch (err) {
        if (!retriable(err)) {
          throw err;
        }
        return {
          kept: withOps(without, (ops) => [...ops, { op: "delete", id }]),
          err,
        };
      }
    });
  }

  async saveSummary(ref: ChangeRef, body: string): Promise<void> {
    const key = refKey(ref);
    await this.queue.run(key, async () => {
      await this.deps.store.put(key, {
        ...(await this.kept(key)),
        summary: body,
      });
    });
  }

  /**
   * Submits the review: the waiting changes first (all must reach the
   * forge), then the pending review with the summary.
   */
  submit(
    ref: ChangeRef,
    event: ReviewEvent,
    body: string,
  ): Promise<ReviewDrafts> {
    const port = this.portOf(ref);
    const key = refKey(ref);
    return this.queue.run(key, async () => {
      let kept = await this.kept(key);
      if (kept.ops?.length) {
        const flushed = await this.flush(port, key, kept);
        kept = flushed.kept;
        if (kept.ops?.length) {
          const f = failureOf(flushed.error);
          throw new AppError(
            f.status,
            `Some draft comments aren't on ${port.forge} yet, so the review wasn't submitted: ${f.error}`,
            f.hint,
          );
        }
      }
      await port.submit(event, body);
      kept = { ...kept, summary: "" };
      await this.deps.store.put(key, kept);
      const sync: ForgeSync = { forge: port.forge, synced: true };
      this.remote.set(
        key,
        await port.threads().catch(() => this.remoteOf(key)),
      );
      return this.view(port, key, kept, sync);
    });
  }

  /** Forgets the forge's threads read for a change. */
  forget(key: string): void {
    this.remote.delete(key);
  }

  /** One change to the pending review: tried on the forge, kept here if it fails. */
  private write(
    ref: ChangeRef,
    change: (
      port: ReviewPort,
      key: string,
      kept: KeptDrafts,
    ) => Promise<{ kept: KeptDrafts; err?: unknown }>,
  ): Promise<ReviewDrafts> {
    const port = this.portOf(ref);
    const key = refKey(ref);
    return this.queue.run(key, async () => {
      const { kept, err } = await change(port, key, await this.kept(key));
      await this.deps.store.put(key, kept);
      const sync =
        err === undefined
          ? { forge: port.forge, synced: true }
          : notSynced(port, "Draft comment not saved", err);
      return this.view(port, key, kept, sync);
    });
  }

  /** Sends the waiting changes; those the forge doesn't take stay. */
  private async flush(
    port: ReviewPort,
    key: string,
    kept: KeptDrafts,
  ): Promise<{ kept: KeptDrafts; sync: ForgeSync; error?: unknown }> {
    const left: DraftOp[] = [];
    let error: unknown;
    for (const op of kept.ops ?? []) {
      try {
        if (op.op === "add") {
          await port.addDraft(op.anchor, op.body);
        } else if (op.op === "edit") {
          await port.editDraft(op.id, op.body);
        } else {
          await port.deleteDraft(op.id);
        }
      } catch (err) {
        // One the forge refuses for good (its lines left the diff) still
        // stays, so the reviewer doesn't lose the text; they can delete it.
        error ??= err;
        left.push(op);
      }
    }
    const next = withOps(kept, () => left);
    await this.deps.store.put(key, next);
    const sync =
      error === undefined
        ? { forge: port.forge, synced: true }
        : notSynced(port, "Draft comments not saved", error);
    return { kept: next, sync, ...(error === undefined ? {} : { error }) };
  }

  private portOf(ref: ChangeRef): ReviewPort {
    const port = this.deps.port(ref);
    if (!port) {
      throw new AppError(404, "Reviews aren't available for this change");
    }
    return port;
  }

  private async kept(key: string): Promise<KeptDrafts> {
    return (await this.deps.store.get<KeptDrafts>(key)) ?? {};
  }

  private remoteOf(key: string): Remote {
    return this.remote.get(key) ?? { threads: [], ownChange: false };
  }

  private editRemote(
    key: string,
    id: string,
    edit: (
      c: ReviewThread["comments"][number],
    ) => ReviewThread["comments"][number],
  ): void {
    const remote = this.remoteOf(key);
    this.remote.set(key, {
      ...remote,
      threads: remote.threads.map((t) => ({
        ...t,
        comments: t.comments.map((c) => (c.id === id ? edit(c) : c)),
      })),
    });
  }

  private view(
    port: ReviewPort,
    key: string,
    kept: KeptDrafts,
    sync: ForgeSync,
  ): ReviewDrafts {
    return draftsView(port, this.remoteOf(key), kept, sync);
  }
}

function withOps(
  kept: KeptDrafts,
  change: (ops: DraftOp[]) => DraftOp[],
): KeptDrafts {
  const ops = change(kept.ops ?? []);
  const { ops: _, ...rest } = kept;
  return ops.length ? { ...rest, ops } : rest;
}

function notSynced(port: ReviewPort, what: string, err: unknown): ForgeSync {
  const f = failureOf(err);
  return {
    forge: port.forge,
    synced: false,
    status: f.status,
    error: `${what} on ${port.forge}: ${f.error}`,
    ...(f.hint ? { hint: f.hint } : {}),
  };
}
