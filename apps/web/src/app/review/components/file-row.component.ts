import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from "@angular/core";
import { IconComponent } from "../../ui/icon.component";
import { basename, dirname, statusLabel } from "../format";
import type { FileView } from "../review-model";

/**
 * A file's header line: fold toggle, tick, path, size, notes, GitHub link.
 * It sticks below the group header (3.5rem + 2.75rem) while its diff scrolls.
 */
@Component({
  selector: "rr-file-row",
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (canExpand()) {
      <button
        type="button"
        class="icon-button-sm"
        (click)="toggle.emit()"
        [attr.aria-expanded]="expanded()"
        [attr.aria-label]="(expanded() ? 'Hide the diff of ' : 'Show the diff of ') + file().path"
      >
        <rr-icon [name]="expanded() ? 'chevron-down' : 'chevron-right'" size="sm" />
      </button>
    } @else {
      <span class="size-6 shrink-0"></span>
    }
    <input
      type="checkbox"
      class="mt-1 size-4 shrink-0 accent-teal-600"
      [checked]="ticked()"
      (change)="tick.emit()"
      [attr.aria-label]="'Reviewed ' + file().path"
    />
    <div class="min-w-0 flex-1" [class.opacity-60]="ticked()">
      <p class="flex min-h-6 flex-wrap items-baseline gap-x-2 leading-6">
        <span class="break-all font-mono text-sm"><span class="text-stone-400">{{ dir() }}</span><span class="font-medium">{{ name() }}</span></span>
        <span class="text-xs">
          <span class="text-emerald-700 dark:text-emerald-400">+{{ file().additions }}</span>
          <span class="ml-1 text-rose-700 dark:text-rose-400">−{{ file().deletions }}</span>
          @if (status()) {
            <span class="ml-2 text-stone-500">{{ status() }}</span>
          }
          @if (file().role !== "source") {
            <span class="ml-2 text-stone-500">{{ file().role }}</span>
          }
        </span>
      </p>
      @if (file().notes.length) {
        <p class="mt-0.5 text-xs text-stone-500">{{ file().notes.join(" · ") }}</p>
      }
    </div>
    @if (comments()) {
      <span class="mt-1 inline-flex items-center gap-0.5 text-xs text-stone-500" [title]="comments() + (comments() === 1 ? ' comment' : ' comments') + ' on this file'">
        <rr-icon name="comment" size="xs" />{{ comments() }}
      </span>
    }
    @if (canComment()) {
      <button
        type="button"
        class="icon-button-sm"
        (click)="commentFile.emit()"
        [attr.aria-label]="'Comment on ' + file().path"
        title="Comment on the file"
      >
        <rr-icon name="comment-add" size="sm" />
      </button>
    }
    @if (file().diff?.link; as link) {
      <a
        [href]="link"
        target="_blank"
        rel="noopener"
        class="icon-button-sm"
        [attr.aria-label]="'Open ' + file().path + ' on GitHub'"
        title="Open on GitHub"
      >
        <rr-icon name="external" size="sm" />
      </a>
    }
  `,
  host: {
    class:
      "sticky top-[calc(6.25rem+var(--review-bar,0px))] z-[5] flex items-start gap-2 bg-white px-2 py-1.5 dark:bg-stone-900",
  },
})
export class FileRowComponent {
  readonly file = input.required<FileView>();
  readonly ticked = input(false);
  readonly expanded = input(false);
  readonly canExpand = input(true);
  /** Threads and drafts on the file. */
  readonly comments = input(0);
  readonly canComment = input(false);
  readonly toggle = output();
  readonly commentFile = output();
  readonly tick = output();
  protected name = () => basename(this.file().path);
  protected dir = () => dirname(this.file().path);
  protected status = () => statusLabel(this.file().status);
}
