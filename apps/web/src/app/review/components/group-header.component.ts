import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from "@angular/core";
import { IconComponent } from "../../ui/icon.component";
import { KIND_LABEL } from "../format";
import type { GroupView } from "../review-model";

/**
 * A group's one-line header. It sticks below the app header (3.5rem) and is
 * 2.75rem high, so file headers can stick below it.
 */
@Component({
  selector: "rr-group-header",
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="icon-button"
      (click)="toggle.emit()"
      [attr.aria-expanded]="!collapsed()"
      [attr.aria-label]="collapsed() ? 'Show group' : 'Fold group'"
    >
      <rr-icon [name]="collapsed() ? 'chevron-right' : 'chevron-down'" />
    </button>
    <h2 class="min-w-0 flex-1 truncate font-semibold" [title]="group().title">
      <span class="mr-1 text-stone-400">{{ group().index + 1 }}.</span>{{ group().title }}
    </h2>
    @if (kind()) {
      <span class="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600 dark:bg-stone-800 dark:text-stone-300">{{ kind() }}</span>
    }
    <button
      type="button"
      class="inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
      (click)="tickAll.emit(!complete())"
      [attr.aria-label]="complete() ? 'Untick all files of this group' : 'Tick all files of this group'"
    >
      <rr-icon [name]="complete() ? 'done' : 'done-all'" size="sm" [class.text-teal-600]="complete()" />
      <span class="tabular-nums">{{ done() }}/{{ group().files.length }}</span>
    </button>
  `,
  host: {
    class:
      "sticky top-[calc(3.5rem+var(--review-bar,0px))] z-10 flex h-11 items-center gap-2 rounded-t-lg border-b border-stone-200 bg-white/95 px-2 backdrop-blur dark:border-stone-800 dark:bg-stone-900/95",
  },
})
export class GroupHeaderComponent {
  readonly group = input.required<GroupView>();
  readonly collapsed = input(false);
  readonly done = input(0);
  readonly toggle = output();
  /** true: tick every file of the group; false: untick them. */
  readonly tickAll = output<boolean>();
  protected readonly kind = computed(() => KIND_LABEL[this.group().kind] ?? "");
  protected readonly complete = computed(
    () => this.done() === this.group().files.length,
  );
}
