import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";
import type { ReviewThread } from "@ripple-review/api-contract";
import { IconComponent } from "../../ui/icon.component";
import { anchorLabel } from "../notes";

/** A thread already on the change, read-only (replies and resolving: on the forge for now). */
@Component({
  selector: "rr-comment-thread",
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-md border border-stone-200 bg-white font-sans dark:border-stone-700 dark:bg-stone-900" [class.opacity-70]="thread().resolved">
      @if (withPlace() || thread().outdated || thread().resolved) {
        <p class="flex flex-wrap gap-2 border-b border-stone-100 px-3 py-1 text-xs text-stone-500 dark:border-stone-800">
          @if (withPlace()) {
            <span>On {{ place() }}</span>
          }
          @if (thread().outdated) {
            <span class="rounded bg-stone-100 px-1.5 dark:bg-stone-800">outdated</span>
          }
          @if (thread().resolved) {
            <span class="rounded bg-stone-100 px-1.5 dark:bg-stone-800">resolved</span>
          }
        </p>
      }
      @for (c of thread().comments; track c.id) {
        <div class="border-b border-stone-100 px-3 py-2 last:border-b-0 dark:border-stone-800">
          <p class="flex items-center gap-2 text-xs text-stone-500">
            <span class="font-semibold text-stone-700 dark:text-stone-300">{{ c.author }}</span>
            <span>{{ when(c.createdAt) }}</span>
            @if (c.pending) {
              <span class="rounded bg-amber-100 px-1.5 text-amber-900 dark:bg-amber-950 dark:text-amber-200">pending</span>
            }
            @if (c.url) {
              <a [href]="c.url" target="_blank" rel="noopener" class="ml-auto icon-button-sm" aria-label="Open the comment on GitHub" title="Open on GitHub">
                <rr-icon name="external" size="xs" />
              </a>
            }
          </p>
          <p class="mt-1 whitespace-pre-wrap break-words text-sm">{{ c.body }}</p>
        </div>
      }
    </div>
  `,
})
export class CommentThreadComponent {
  readonly thread = input.required<ReviewThread>();
  /** Say which lines it is on (when shown above the diff, not at its line). */
  readonly withPlace = input(false);

  protected readonly place = computed(() => anchorLabel(this.thread().anchor));

  protected when(at: string): string {
    const d = new Date(at);
    return Number.isNaN(d.getTime())
      ? ""
      : d.toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        });
  }
}
