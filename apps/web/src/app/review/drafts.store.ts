import {
  computed,
  DestroyRef,
  Injectable,
  inject,
  signal,
} from "@angular/core";
import type {
  ChangeRef,
  DraftComment,
  ReviewDrafts,
  ReviewEvent,
  ReviewThread,
} from "@ripple-review/api-contract";
import type { ApiFailure } from "../core/api-failure";
import { EngineService } from "../core/engine.service";
import type { DiffRow } from "./diff-rows";
import { anchorOf, type Composing, composeAt } from "./notes";

/** A file's threads and drafts. */
export interface FileComments {
  threads: ReviewThread[];
  drafts: DraftComment[];
}

const NONE: FileComments = { threads: [], drafts: [] };

/**
 * The review the reviewer writes on the forge (where it has reviews): the
 * threads already there, their drafts, the summary, and the comment being
 * written.
 */
@Injectable()
export class DraftsStore {
  private readonly api = inject(EngineService);
  private ref?: ChangeRef;
  private generation = 0;
  private summaryTimer?: ReturnType<typeof setTimeout>;

  /** Undefined: not loaded, or the forge has no reviews (then nothing is offered). */
  readonly state = signal<ReviewDrafts | undefined>(undefined);
  readonly composing = signal<Composing | undefined>(undefined);
  /** A write is under way (one at a time). */
  readonly saving = signal(false);
  readonly error = signal<ApiFailure | undefined>(undefined);
  readonly summary = signal("");
  /** How the last review was submitted, to say so. */
  readonly submitted = signal<ReviewEvent | undefined>(undefined);

  readonly byPath = computed(() => {
    const s = this.state();
    const out = new Map<string, FileComments>();
    const of = (path: string) => {
      let f = out.get(path);
      if (!f) {
        f = { threads: [], drafts: [] };
        out.set(path, f);
      }
      return f;
    };
    for (const t of s?.threads ?? []) {
      of(t.anchor.path).threads.push(t);
    }
    for (const d of s?.drafts ?? []) {
      of(d.anchor.path).drafts.push(d);
    }
    return out;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.flushSummary());
  }

  of(path: string): FileComments {
    return this.byPath().get(path) ?? NONE;
  }

  async load(ref: ChangeRef): Promise<void> {
    this.flushSummary();
    this.ref = ref;
    const gen = ++this.generation;
    this.state.set(undefined);
    this.composing.set(undefined);
    this.error.set(undefined);
    this.submitted.set(undefined);
    try {
      const s = await this.api.drafts(ref);
      if (gen === this.generation) {
        this.state.set(s);
        this.summary.set(s?.summary ?? "");
      }
    } catch (err) {
      if (gen === this.generation) {
        this.error.set(err as ApiFailure);
      }
    }
  }

  /** A click on a line's "+" (with shift: extend to a range). */
  composeLine(
    path: string,
    rows: readonly DiffRow[],
    row: number,
    extend: boolean,
  ): void {
    const next = composeAt(rows, path, row, extend, this.composing());
    this.composing.set(
      this.state()?.ranges || !next ? next : { ...next, start: next.end },
    );
  }

  composeFile(path: string): void {
    this.composing.set({ path });
  }

  cancel(): void {
    this.composing.set(undefined);
  }

  /** Adds the comment being composed; true when it was taken (here or on the forge). */
  async add(body: string): Promise<boolean> {
    const c = this.composing();
    if (!c) {
      return false;
    }
    const ok = await this.write((ref) =>
      this.api.addDraft(ref, anchorOf(c), body),
    );
    if (ok) {
      this.composing.set(undefined);
    }
    return ok;
  }

  edit(id: string, body: string): Promise<boolean> {
    return this.write((ref) => this.api.editDraft(ref, id, body));
  }

  remove(id: string): Promise<boolean> {
    return this.write((ref) => this.api.deleteDraft(ref, id));
  }

  /** The summary as typed; kept in the browser shortly after typing stops. */
  setSummary(body: string): void {
    this.summary.set(body);
    clearTimeout(this.summaryTimer);
    this.summaryTimer = setTimeout(() => this.flushSummary(), 400);
  }

  private flushSummary(): void {
    if (this.summaryTimer === undefined || !this.ref) {
      return;
    }
    clearTimeout(this.summaryTimer);
    this.summaryTimer = undefined;
    void this.api.saveSummary(this.ref, this.summary()).catch(() => {});
  }

  async submit(event: ReviewEvent): Promise<boolean> {
    clearTimeout(this.summaryTimer);
    this.summaryTimer = undefined;
    const body = this.summary();
    const ok = await this.write((ref) =>
      this.api.submitReview(ref, event, body),
    );
    if (ok) {
      this.submitted.set(event);
      this.summary.set("");
    }
    return ok;
  }

  private async write(
    run: (ref: ChangeRef) => Promise<ReviewDrafts>,
  ): Promise<boolean> {
    const ref = this.ref;
    if (!ref || this.saving()) {
      return false;
    }
    const gen = this.generation;
    this.saving.set(true);
    this.error.set(undefined);
    try {
      const s = await run(ref);
      if (gen === this.generation) {
        this.state.set(s);
      }
      return true;
    } catch (err) {
      if (gen === this.generation) {
        this.error.set(err as ApiFailure);
      }
      return false;
    } finally {
      this.saving.set(false);
    }
  }
}
