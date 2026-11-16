import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import type {
  PullRequestSummary,
  RecentChange,
} from "@ripple-review/api-contract";
import { ago } from "../core/format";
import { labelOf, routeOf } from "../core/refs";
import { progressIn } from "../core/stacks";
import { IconComponent } from "../ui/icon.component";
import { PullTreeComponent } from "../ui/pull-tree.component";
import { recentItems } from "./recent-items";

/** "Recently viewed": the changes opened here, a stack's as the whole stack. */
@Component({
  selector: "rr-recent-list",
  imports: [IconComponent, PullTreeComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="divide-y divide-stone-200 rounded-md border border-stone-200 dark:divide-stone-800 dark:border-stone-800">
      @for (item of items(); track item.key) {
        @if (item.stack; as stack) {
          <li class="px-1 pt-2">
            <p class="px-2 text-xs text-stone-500">
              {{ item.owner }}/{{ item.repo }} · a stack of {{ stack.rows.length }} · viewed {{ ago(item.openedAt) }}
            </p>
            <rr-pull-tree
              [stacks]="[stack]"
              [owner]="item.owner"
              [repo]="item.repo"
              [progress]="progressOf(item.owner, item.repo)"
              [showAuthor]="false"
            />
          </li>
        } @else if (item.change; as c) {
          <li>
            <a [routerLink]="route(c)" class="flex items-center gap-3 px-3 py-2 hover:bg-stone-100 dark:hover:bg-stone-900">
              <span class="min-w-0 flex-1">
                <span class="block truncate">{{ c.title ?? label(c) }}</span>
                <span class="block truncate text-xs text-stone-500">{{ label(c) }} · {{ ago(c.openedAt) }}</span>
              </span>
              @if (c.files && c.ticked === c.files) {
                <span class="flex shrink-0 items-center gap-1 text-xs text-teal-700 dark:text-teal-400">
                  <rr-icon name="done" size="xs" /> reviewed
                </span>
              } @else if (c.files) {
                <span class="shrink-0 text-xs tabular-nums text-stone-500">{{ c.ticked }}/{{ c.files }} files</span>
              }
            </a>
          </li>
        }
      }
    </ul>
  `,
})
export class RecentListComponent {
  readonly recent = input.required<RecentChange[]>();
  /** Open pull requests of their repositories, by `owner/repo`: for the stacks. */
  readonly pulls = input<ReadonlyMap<string, PullRequestSummary[]>>(new Map());

  protected readonly items = computed(() =>
    recentItems(this.recent(), this.pulls()),
  );
  protected readonly ago = ago;

  protected progressOf(owner: string, repo: string) {
    return progressIn(this.recent(), owner, repo);
  }

  protected label(c: RecentChange): string {
    return labelOf(c.ref);
  }

  protected route(c: RecentChange): string[] {
    return routeOf(c.ref);
  }
}
