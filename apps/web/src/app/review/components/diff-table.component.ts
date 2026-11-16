import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from "@angular/core";
import type { Token } from "../../core/highlight.service";
import { IconComponent } from "../../ui/icon.component";
import {
  type DiffRow,
  EXPAND_STEP,
  type GapRow,
  type LineRow,
} from "../diff-rows";
import type { Notes } from "../notes";
import { NotesComponent } from "./notes.component";

/** A click on a line's "+": comment on it, or with shift, on the range up to it. */
export interface CommentRequest {
  row: number;
  extend: boolean;
}

export interface ExpandRequest {
  gap: number;
  how: "up" | "down" | "all";
}

/**
 * A diff as a table: old and new line numbers, the line (highlighted when
 * tokens are given), and gap rows that open hidden lines like GitHub's.
 */
@Component({
  selector: "rr-diff-table",
  imports: [IconComponent, NotesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overflow-x-auto">
      <table class="diff w-full border-collapse font-mono text-xs leading-5">
        <tbody>
          @for (row of rows(); track $index) {
            @if (row.kind === "gap") {
              <tr class="bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
                <td colspan="2" class="px-1 py-0.5">
                  <span class="flex flex-col items-center gap-0.5">
                    @if (canOpenAll(row)) {
                      <button type="button" class="icon-button-xs" (click)="expand.emit({ gap: row.gap, how: 'all' })" [attr.aria-label]="'Show ' + (row.hidden ?? 'the') + ' hidden lines'" title="Show all">
                        <rr-icon name="expand-all" size="xs" />
                      </button>
                    } @else {
                      @if (row.up) {
                        <button type="button" class="icon-button-xs" (click)="expand.emit({ gap: row.gap, how: 'up' })" aria-label="Show more lines above" title="Show more above">
                          <rr-icon name="expand-up" size="xs" />
                        </button>
                      }
                      @if (row.down) {
                        <button type="button" class="icon-button-xs" (click)="expand.emit({ gap: row.gap, how: 'down' })" aria-label="Show more lines below" title="Show more below">
                          <rr-icon name="expand-down" size="xs" />
                        </button>
                      }
                    }
                  </span>
                </td>
                <td class="px-3 py-0.5">
                  {{ row.header ?? "" }}
                  @if (row.hidden !== undefined) {
                    <span class="ml-2 text-sky-600 dark:text-sky-400">{{ row.hidden }} hidden {{ row.hidden === 1 ? "line" : "lines" }}</span>
                  }
                  @if (loading()) {
                    <span class="ml-2 text-sky-600">loading …</span>
                  }
                </td>
              </tr>
            } @else {
              <tr [class]="rowClass[row.kind]" class="group" [style.box-shadow]="isSelected($index) ? 'inset 3px 0 0 #0d9488' : null">
                <td class="relative w-12 select-none px-2 text-right text-stone-400">
                  @if (commentable() && row.hunk !== undefined) {
                    <button
                      type="button"
                      class="absolute top-0 left-0.5 inline-flex size-5 items-center justify-center rounded bg-teal-600 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                      (click)="comment.emit({ row: $index, extend: $event.shiftKey })"
                      [attr.aria-label]="'Comment on line ' + (row.newNo ?? row.oldNo) + ' (shift: on the lines up to it)'"
                      title="Comment (shift-click: a range)"
                    ><rr-icon name="add" size="xs" /></button>
                  }
                  {{ row.oldNo }}
                </td>
                <td class="w-12 select-none px-2 text-right text-stone-400">{{ row.newNo }}</td>
                <td class="whitespace-pre px-3"><span class="select-none text-stone-400">{{ sign[row.kind] }}</span>@if (tokensOf(row); as tokens) {@for (t of tokens; track $index) {<span [style]="t.style">{{ t.text }}</span>}} @else {<span>{{ row.text }}</span>}</td>
              </tr>
              @if (notes().get($index); as n) {
                <tr>
                  <td colspan="3" class="border-y border-stone-200 bg-stone-50 px-3 py-2 dark:border-stone-800 dark:bg-stone-950/50">
                    <rr-notes [notes]="n" />
                  </td>
                </tr>
              }
            }
          }
        </tbody>
      </table>
    </div>
  `,
})
export class DiffTableComponent {
  readonly rows = input.required<DiffRow[]>();
  /** Highlighted lines by line number: new side (context, additions) and old side (deletions). */
  readonly newTokens = input<ReadonlyMap<number, Token[]>>(new Map());
  readonly oldTokens = input<ReadonlyMap<number, Token[]>>(new Map());
  readonly loading = input(false);
  /** Threads, drafts and the new comment's form, by the row they follow. */
  readonly notes = input<ReadonlyMap<number, Notes>>(new Map());
  /** Whether lines of the diff take comments (the forge has reviews). */
  readonly commentable = input(false);
  /** The rows the comment being written is on. */
  readonly selected = input<{ from: number; to: number }>();
  readonly expand = output<ExpandRequest>();
  readonly comment = output<CommentRequest>();

  protected readonly rowClass: Record<LineRow["kind"], string> = {
    add: "bg-emerald-50 dark:bg-emerald-950/40",
    del: "bg-rose-50 dark:bg-rose-950/40",
    ctx: "",
  };
  protected readonly sign: Record<LineRow["kind"], string> = {
    add: "+",
    del: "−",
    ctx: " ",
  };

  protected isSelected(i: number): boolean {
    const s = this.selected();
    return s !== undefined && i >= s.from && i <= s.to;
  }

  protected canOpenAll(row: GapRow): boolean {
    return row.hidden !== undefined && row.hidden <= EXPAND_STEP;
  }

  protected tokensOf(row: LineRow): Token[] | undefined {
    return row.kind === "del"
      ? this.oldTokens().get(row.oldNo ?? 0)
      : this.newTokens().get(row.newNo ?? 0);
  }
}
