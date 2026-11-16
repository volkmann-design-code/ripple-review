import {
  computed,
  DestroyRef,
  Injectable,
  inject,
  signal,
  type WritableSignal,
} from "@angular/core";
import type {
  ChangeRef,
  ReviewPayload,
  ViewedSync,
} from "@ripple-review/api-contract";
import { type ApiFailure, EngineService } from "../core/engine.service";
import { groupViews, ticksOf } from "./review-model";

/** State of one review page: the review, the ticks, what is expanded. */
@Injectable()
export class ReviewStore {
  private readonly api = inject(EngineService);
  private ref?: ChangeRef;
  /** Increases with each load, so a late answer for an older ref is dropped. */
  private generation = 0;

  readonly review = signal<ReviewPayload | undefined>(undefined);
  readonly loading = signal(false);
  readonly refining = signal(false);
  readonly error = signal<ApiFailure | undefined>(undefined);
  readonly saveError = signal<string | undefined>(undefined);
  /** Whether the ticks are the forge's "Viewed" marks, as of the last load or save. */
  readonly viewedSync = signal<ViewedSync | undefined>(undefined);
  /** What the engine is doing for the current request, and for how long. */
  readonly stage = signal<string | undefined>(undefined);
  readonly elapsed = signal(0);
  private timer?: ReturnType<typeof setInterval>;
  readonly ticked = signal<ReadonlySet<string>>(new Set());
  readonly expanded = signal<ReadonlySet<string>>(new Set());
  /** Files at head, loaded when the reviewer expands a diff's context. */
  readonly fileLines = signal<ReadonlyMap<string, readonly string[]>>(
    new Map(),
  );
  /** Indices of folded groups; generated ones start folded. */
  readonly collapsed = signal<ReadonlySet<number>>(new Set());

  readonly groups = computed(() => {
    const r = this.review();
    return r ? groupViews(r) : [];
  });
  readonly fileCount = computed(() =>
    this.groups().reduce((s, g) => s + g.files.length, 0),
  );
  readonly tickedCount = computed(() => this.ticked().size);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopClock());
  }

  private startClock(): void {
    this.stopClock();
    const start = Date.now();
    this.stage.set(undefined);
    this.elapsed.set(0);
    this.timer = setInterval(
      () => this.elapsed.set(Math.round((Date.now() - start) / 1000)),
      1000,
    );
  }

  private stopClock(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  /** Loads the review the way the reviewer last chose (static or AI). */
  load(ref: ChangeRef): Promise<void> {
    this.ref = ref;
    this.review.set(undefined);
    this.refining.set(false);
    this.fileLines.set(new Map());
    return this.fetch(undefined, this.loading);
  }

  /** Asks the AI layer to name, order and place; remembered for reloads. */
  refine(): Promise<void> {
    return this.busy() ? Promise.resolve() : this.fetch(true, this.refining);
  }

  /** Back to the static analysis' order; remembered too. */
  showStatic(): Promise<void> {
    return this.busy() ? Promise.resolve() : this.fetch(false, this.refining);
  }

  private busy(): boolean {
    return this.loading() || this.refining();
  }

  /** A newer request supersedes an older one (its answer is dropped). */
  private async fetch(
    ai: boolean | undefined,
    busy: WritableSignal<boolean>,
  ): Promise<void> {
    const ref = this.ref;
    if (!ref) {
      return;
    }
    const gen = ++this.generation;
    const current = () => gen === this.generation;
    busy.set(true);
    this.error.set(undefined);
    this.startClock();
    try {
      const r = await this.api.review(ref, ai, (m) => {
        if (current()) {
          this.stage.set(m);
        }
      });
      if (current()) {
        this.show(r);
      }
    } catch (err) {
      if (current()) {
        this.error.set(err as ApiFailure);
      }
    } finally {
      if (current()) {
        busy.set(false);
        this.stopClock();
      }
    }
  }

  /** Loads a file's lines at head once; afterwards they are in `fileLines`. */
  async loadLines(path: string): Promise<void> {
    const ref = this.ref;
    if (!ref || this.fileLines().has(path) || this.pendingLines.has(path)) {
      return;
    }
    this.pendingLines.add(path);
    try {
      const { lines } = await this.api.fileLines(ref, path);
      this.fileLines.set(new Map(this.fileLines()).set(path, lines));
    } catch (err) {
      this.saveError.set(
        `Can't expand ${path}: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.pendingLines.delete(path);
    }
  }
  private readonly pendingLines = new Set<string>();

  private show(r: ReviewPayload): void {
    this.review.set(r);
    this.viewedSync.set(r.viewedSync);
    this.ticked.set(new Set(r.ticks.map((t) => t.path)));
    // Small diffs open; large ones and generated files on demand.
    const open = new Set<string>();
    const views = groupViews(r);
    this.collapsed.set(
      new Set(views.filter((g) => g.collapsed).map((g) => g.index)),
    );
    for (const g of views) {
      if (g.collapsed) {
        continue;
      }
      const files = g.kind === "mechanical" ? g.files.slice(0, 1) : g.files;
      for (const f of files) {
        if (f.additions + f.deletions <= 120) {
          open.add(f.path);
        }
      }
    }
    this.expanded.set(open);
  }

  toggleTick(path: string): void {
    const next = new Set(this.ticked());
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
      // A ticked file is done: fold it away.
      this.setExpanded(path, false);
    }
    this.ticked.set(next);
    void this.save(next);
  }

  tickAll(paths: string[], on: boolean): void {
    const next = new Set(this.ticked());
    for (const p of paths) {
      if (on) {
        next.add(p);
      } else {
        next.delete(p);
      }
    }
    this.ticked.set(next);
    void this.save(next);
  }

  toggleCollapsed(index: number): void {
    const next = new Set(this.collapsed());
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    this.collapsed.set(next);
  }

  toggleExpanded(path: string): void {
    this.setExpanded(path, !this.expanded().has(path));
  }

  private setExpanded(path: string, open: boolean): void {
    const next = new Set(this.expanded());
    if (open) {
      next.add(path);
    } else {
      next.delete(path);
    }
    this.expanded.set(next);
  }

  private async save(ticked: ReadonlySet<string>): Promise<void> {
    const r = this.review();
    if (!this.ref || !r) {
      return;
    }
    try {
      const saved = await this.api.saveProgress(
        this.ref,
        ticksOf(ticked, r.files),
      );
      this.viewedSync.set(saved.viewedSync);
      this.saveError.set(undefined);
    } catch (err) {
      this.saveError.set(
        `Ticks not saved: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
