import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from "@angular/core";
import type { FileDiff } from "@ripple-review/api-contract";
import { HighlightService, type Token } from "../../core/highlight.service";
import { diffRows, type Revealed, reveal, runs } from "../diff-rows";
import { DraftsStore } from "../drafts.store";
import { placeNotes, selectedRows } from "../notes";
import { ReviewStore } from "../review.store";
import {
  type CommentRequest,
  DiffTableComponent,
  type ExpandRequest,
} from "./diff-table.component";
import { NotesComponent } from "./notes.component";

/**
 * One file's diff: keeps which gaps are open, asks the store for the file's
 * lines when the reviewer opens one, and highlights what is shown.
 */
@Component({
  selector: "rr-file-diff",
  imports: [DiffTableComponent, NotesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (placed().file; as file) {
      @if (file.threads.length || file.drafts.length || file.form) {
        <rr-notes class="block border-b border-stone-100 bg-stone-50 px-4 py-2 dark:border-stone-800 dark:bg-stone-950/50" [notes]="file" [withPlace]="true" />
      }
    }
    @if (diff().binary) {
      <p class="px-4 py-3 text-sm text-stone-500">Binary file</p>
    } @else if (diff().hunks.length === 0) {
      <p class="px-4 py-3 text-sm text-stone-500">
        No textual changes{{ diff().oldPath ? " (renamed from " + diff().oldPath + ")" : "" }}
      </p>
    } @else {
      <rr-diff-table
        [rows]="rows()"
        [newTokens]="tokens().new"
        [oldTokens]="tokens().old"
        [loading]="waiting()"
        [notes]="placed().at"
        [commentable]="!!drafts.state()"
        [selected]="selected()"
        (expand)="open($event)"
        (comment)="compose($event)"
      />
    }
  `,
})
export class FileDiffComponent {
  private readonly store = inject(ReviewStore);
  private readonly highlight = inject(HighlightService);
  protected readonly drafts = inject(DraftsStore);

  readonly diff = input.required<FileDiff>();
  readonly path = input.required<string>();

  private readonly revealed = signal<Revealed>({});
  private readonly lines = computed(() =>
    this.store.fileLines().get(this.path()),
  );
  protected readonly waiting = computed(
    () => Object.keys(this.revealed()).length > 0 && !this.lines(),
  );
  protected readonly rows = computed(() =>
    diffRows(this.diff().hunks, this.lines(), this.revealed()),
  );
  private readonly composing = computed(() => {
    const c = this.drafts.composing();
    return c?.path === this.path() ? c : undefined;
  });
  protected readonly placed = computed(() => {
    const { threads, drafts } = this.drafts.of(this.path());
    return placeNotes(this.rows(), threads, drafts, this.composing());
  });
  protected readonly selected = computed(() =>
    selectedRows(this.rows(), this.composing()),
  );
  protected readonly tokens = signal<{
    new: ReadonlyMap<number, Token[]>;
    old: ReadonlyMap<number, Token[]>;
  }>({ new: new Map(), old: new Map() });

  constructor() {
    effect((onCleanup) => {
      const rows = this.rows();
      const path = this.path();
      if (!this.highlight.canHighlight(path)) {
        return;
      }
      let stale = false;
      onCleanup(() => {
        stale = true;
      });
      void Promise.all(
        (["new", "old"] as const).map(async (side) => {
          const out = new Map<number, Token[]>();
          for (const run of runs(rows, side)) {
            const lines = await this.highlight.tokenize(path, run.text);
            for (const [i, tokens] of (lines ?? []).entries()) {
              out.set(run.start + i, tokens);
            }
          }
          return out;
        }),
      ).then(([n, o]) => {
        if (!stale && n && o) {
          this.tokens.set({ new: n, old: o });
        }
      });
    });
  }

  protected compose(e: CommentRequest): void {
    this.drafts.composeLine(this.path(), this.rows(), e.row, e.extend);
  }

  protected open(e: ExpandRequest): void {
    this.revealed.set(reveal(this.revealed(), e.gap, e.how));
    void this.store.loadLines(this.path());
  }
}
