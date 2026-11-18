import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from "@angular/core";
import { DraftsStore } from "../drafts.store";
import { type GroupView, tickedCount } from "../review-model";
import { SpyDirective } from "../scroll-spy";
import { FileDiffComponent } from "./file-diff.component";
import { FileRowComponent } from "./file-row.component";
import { GroupHeaderComponent } from "./group-header.component";

/** One group: its sticky header, its purpose, and its files with their diffs. */
@Component({
  selector: "rr-group-card",
  imports: [
    GroupHeaderComponent,
    FileRowComponent,
    FileDiffComponent,
    SpyDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <rr-group-header
      [group]="group()"
      [collapsed]="collapsed()"
      [done]="done()"
      (toggle)="toggleCollapsed.emit()"
      (tickAll)="tickAll.emit($event)"
    />
    @if (!collapsed()) {
      @if (group().purpose) {
        <p class="border-b border-stone-100 px-4 py-2 text-sm text-stone-600 dark:border-stone-800 dark:text-stone-400">{{ group().purpose }}</p>
      }
      <!-- A tinted gap between files, so one file's diff doesn't run into the next file. -->
      <ul class="flex flex-col gap-2 rounded-b-lg bg-stone-50 dark:bg-stone-950/60">
        @for (f of group().files; track f.path; let i = $index) {
          @let open = expanded().has(f.path) && withDiff(i);
          <!-- Lands below the group header (2.75rem) when scrolled to. -->
          <li
            class="scroll-mt-11 border-y border-stone-200 bg-white first:border-t-0 last:rounded-b-lg last:border-b-0 dark:border-stone-800 dark:bg-stone-900"
            [id]="fileId(f.n)"
            [rrSpy]="{ group: group().id, file: f.path }"
          >
            <rr-file-row
              [file]="f"
              [ticked]="ticked().has(f.path)"
              [expanded]="open"
              [canExpand]="!!f.diff && withDiff(i)"
              [comments]="commentCount(f.path)"
              [canComment]="!!drafts.state()?.fileComments && !!f.diff && withDiff(i)"
              (toggle)="toggleFile.emit(f.path)"
              (commentFile)="commentOn(f.path, open)"
              (tick)="tick.emit(f.path)"
            />
            @if (open && f.diff) {
              <rr-file-diff class="block border-t border-stone-100 dark:border-stone-800" [diff]="f.diff" [path]="f.path" />
            }
          </li>
        }
      </ul>
    }
  `,
  host: {
    class:
      "block rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900",
    "[id]": "group().id",
  },
})
export class GroupCardComponent {
  protected readonly drafts = inject(DraftsStore);
  readonly group = input.required<GroupView>();
  readonly collapsed = input(false);
  readonly ticked = input.required<ReadonlySet<string>>();
  readonly expanded = input.required<ReadonlySet<string>>();
  readonly toggleCollapsed = output();
  readonly tickAll = output<boolean>();
  readonly tick = output<string>();
  readonly toggleFile = output<string>();

  protected readonly done = computed(() =>
    tickedCount(
      this.group().files.map((f) => f.path),
      this.ticked(),
    ),
  );

  protected commentCount(path: string): number {
    const c = this.drafts.of(path);
    return c.threads.length + c.drafts.length;
  }

  /** A comment on the whole file: its form goes above the diff, so the diff opens. */
  protected commentOn(path: string, open: boolean): void {
    if (!open) {
      this.toggleFile.emit(path);
    }
    this.drafts.composeFile(path);
  }

  protected readonly fileId = fileId;

  /** In a mechanical group only the first file's diff is worth reading. */
  protected withDiff(i: number): boolean {
    return this.group().kind !== "mechanical" || i === 0;
  }
}

/** A file's anchor on the page, by its place in the reading order. */
export const fileId = (n: number) => `file-${n}`;
