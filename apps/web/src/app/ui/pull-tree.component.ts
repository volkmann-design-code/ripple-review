import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { RouterLink } from "@angular/router";
import type { RecentChange } from "@ripple-review/api-contract";
import { routeOf } from "../core/refs";
import type { Stack, StackRow } from "../core/stacks";
import { IconComponent } from "./icon.component";

/**
 * Pull requests as stacks: tree lines from each to the one it sits on, the
 * reviewer's progress where they opened it here, its number, title and
 * branch. Columns are 1rem wide and lines sit at their centre, so a
 * connector meets its parent's marker.
 */
@Component({
  selector: "rr-pull-tree",
  imports: [IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="divide-y divide-stone-200 dark:divide-stone-800">
      @for (stack of stacks(); track stack.rows[0]?.pr?.number) {
        <li class="py-1">
          @for (row of stack.rows; track row.pr.number) {
            @let pr = row.pr;
            @let here = pr.number === current();
            @let seen = progress()?.get(pr.number);
            <div class="flex text-sm" [class]="here ? 'rounded bg-teal-50 dark:bg-teal-950/50' : ''">
              @for (rail of row.rails; track $index) {
                <span class="relative w-4 shrink-0">
                  @if (rail) {
                    <span class="absolute inset-y-0 left-2 border-l border-stone-300 dark:border-stone-700"></span>
                  }
                </span>
              }
              @if (row.depth > 0) {
                <span class="relative w-4 shrink-0">
                  <span class="absolute top-0 left-2 h-4 border-l border-stone-300 dark:border-stone-700"></span>
                  <span class="absolute top-4 left-2 w-2 border-t border-stone-300 dark:border-stone-700"></span>
                  @if (!row.last) {
                    <span class="absolute top-4 bottom-0 left-2 border-l border-stone-300 dark:border-stone-700"></span>
                  }
                </span>
              }
              <span class="relative flex h-8 w-4 shrink-0 items-center justify-center" [title]="markTitle(row, seen)">
                @if (seen && seen.files && seen.ticked === seen.files) {
                  <rr-icon name="done" size="xs" class="text-teal-600" />
                } @else {
                  <span
                    class="size-2 rounded-full"
                    [class]="here ? 'bg-teal-600' : seen ? 'border border-teal-600' : 'bg-stone-300 dark:bg-stone-600'"
                  ></span>
                }
              </span>
              @if (row.hasChildren) {
                <span class="relative -ml-4 w-4 shrink-0">
                  <span class="absolute top-6 bottom-0 left-2 border-l border-stone-300 dark:border-stone-700"></span>
                </span>
              }
              <a
                [routerLink]="route(pr.number)"
                class="group min-w-0 flex-1 py-1.5 pr-2 pl-1.5"
                [attr.aria-current]="here ? 'page' : null"
                [title]="pr.title"
              >
                <span class="flex min-w-0 items-baseline gap-1.5">
                  <span class="shrink-0 text-xs tabular-nums text-stone-500">#{{ pr.number }}</span>
                  <span
                    class="truncate group-hover:underline"
                    [class.font-medium]="here"
                    [class.text-stone-400]="pr.draft && !here"
                  >{{ pr.title }}</span>
                  @if (partly(seen); as part) {
                    <span class="ml-auto shrink-0 pl-1 text-xs tabular-nums text-stone-500">{{ part }}</span>
                  }
                </span>
                <span class="flex min-w-0 items-center gap-1.5 text-xs text-stone-500">
                  @if (pr.head) {
                    <span class="truncate font-mono" [title]="pr.head + ' → ' + pr.base">{{ pr.head }}</span>
                  }
                  @if (row.orphan) {
                    <span
                      class="shrink-0 rounded bg-amber-50 px-1 font-mono text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      [title]="'Its base, ' + pr.base + ', is not ' + pr.defaultBranch + ' and no open pull request here has it as its branch. Was the one below merged?'"
                    >→ {{ pr.base }}</span>
                  }
                  @if (pr.draft) {
                    <span class="shrink-0 rounded bg-stone-100 px-1 dark:bg-stone-800">draft</span>
                  }
                  @if (showAuthor() && pr.author) {
                    <span class="ml-auto shrink-0">{{ pr.author }}</span>
                  }
                </span>
              </a>
            </div>
          }
        </li>
      }
    </ul>
  `,
})
export class PullTreeComponent {
  readonly stacks = input.required<Stack[]>();
  readonly owner = input.required<string>();
  readonly repo = input.required<string>();
  /** The pull request being reviewed, marked. */
  readonly current = input<number>();
  /** The reviewer's progress on the ones opened here, by number. */
  readonly progress = input<ReadonlyMap<number, RecentChange>>();
  readonly showAuthor = input(true);

  protected route(n: number): string[] {
    return routeOf({
      kind: "github",
      owner: this.owner(),
      repo: this.repo(),
      number: n,
    });
  }

  /** "3/12" while some files of one opened here are left. */
  protected partly(seen?: RecentChange): string | undefined {
    return seen?.files && seen.ticked < seen.files
      ? `${seen.ticked}/${seen.files}`
      : undefined;
  }

  protected markTitle(row: StackRow, seen?: RecentChange): string {
    const where = row.depth > 0 ? "On the one above: review that first." : "";
    const done = seen?.files
      ? `${seen.ticked} of ${seen.files} files reviewed.`
      : seen
        ? "Opened here."
        : "Not opened here yet.";
    return [where, done].filter(Boolean).join(" ");
  }
}
