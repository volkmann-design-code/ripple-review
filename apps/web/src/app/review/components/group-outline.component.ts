import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
} from "@angular/core";
import { IconComponent } from "../../ui/icon.component";
import { basename } from "../format";
import { type GroupView, tickedCount } from "../review-model";
import type { SeenLevel } from "../scroll-spy";

/** A file's highlight, stronger the more of it is seen. */
const SEEN: Record<SeenLevel, string> = {
  1: "border-teal-600/30 bg-teal-100/25 text-teal-900 dark:bg-teal-900/20 dark:text-teal-100",
  2: "border-teal-600/55 bg-teal-100/50 text-teal-900 dark:bg-teal-900/40 dark:text-teal-100",
  3: "border-teal-600/80 bg-teal-100/75 text-teal-900 dark:bg-teal-900/60 dark:text-teal-100",
  4: "border-teal-600 bg-teal-100 text-teal-900 dark:bg-teal-900/80 dark:text-teal-100",
};

/**
 * The groups as a list to jump to, with their progress; the groups on
 * screen are open, with their files, and the files on screen are marked,
 * more strongly the more of them is seen.
 */
@Component({
  selector: "rr-group-outline",
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav aria-label="Groups and files">
      <ol class="space-y-0.5 text-sm">
        @for (g of groups(); track g.id) {
          @let done = count(g);
          @let open = openGroups().has(g.id);
          <li>
            <button
              type="button"
              (click)="select.emit(g)"
              class="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-stone-200/60 dark:hover:bg-stone-800/60"
              [class.text-stone-400]="done === g.files.length && !open"
              [class.font-medium]="open"
              [attr.aria-current]="open ? 'location' : null"
              [attr.data-active]="open ? '' : null"
            >
              <span class="w-5 shrink-0 text-right tabular-nums text-stone-400">{{ g.index + 1 }}</span>
              <span class="min-w-0 flex-1 truncate" [title]="g.title">{{ g.title }}</span>
              @if (done === g.files.length) {
                <rr-icon name="done" size="xs" class="text-teal-600" />
              } @else {
                <span class="shrink-0 text-xs font-normal tabular-nums text-stone-400">{{ done }}/{{ g.files.length }}</span>
              }
            </button>
            @if (open) {
              <ol class="mb-1 ml-[1.375rem] border-l border-stone-200 dark:border-stone-800">
                @for (f of g.files; track f.path) {
                  @let seen = activeFiles().get(f.path);
                  @let isTicked = ticked().has(f.path);
                  <li>
                    <button
                      type="button"
                      (click)="selectFile.emit({ group: g, path: f.path })"
                      class="-ml-px flex w-full items-center gap-1.5 border-l py-0.5 pr-2 pl-3 text-left font-mono text-xs hover:bg-stone-200/60 dark:hover:bg-stone-800/60"
                      [class]="seen
                        ? SEEN[seen]
                        : 'border-transparent ' + (isTicked ? 'text-stone-400' : 'text-stone-600 dark:text-stone-400')"
                      [attr.aria-current]="seen ? 'location' : null"
                      [attr.data-active]="seen ? '' : null"
                      [attr.data-seen]="seen ?? null"
                      [title]="f.path"
                    >
                      <span class="min-w-0 flex-1 truncate">{{ shortName(g, f.path) }}</span>
                      @if (isTicked) {
                        <rr-icon name="done" size="xs" class="text-teal-600" />
                      }
                    </button>
                  </li>
                }
              </ol>
            }
          </li>
        }
      </ol>
    </nav>
  `,
})
export class GroupOutlineComponent {
  readonly groups = input.required<GroupView[]>();
  readonly ticked = input.required<ReadonlySet<string>>();
  /** The groups on screen (ids), open with their files; the files on screen (paths). */
  readonly openGroups = input<ReadonlySet<string>>(new Set());
  readonly activeFiles = input<ReadonlyMap<string, SeenLevel>>(new Map());
  protected readonly SEEN = SEEN;
  readonly select = output<GroupView>();
  readonly selectFile = output<{ group: GroupView; path: string }>();

  private readonly host =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    // The outline scrolls on its own: keep what is on screen in sight,
    // from its first group to its last file as far as they fit.
    afterRenderEffect(() => {
      this.openGroups();
      this.activeFiles();
      const marked = this.host.querySelectorAll("[data-active]");
      const first = marked[0];
      const last = marked[marked.length - 1];
      if (!first || !last) {
        return;
      }
      const box = this.host.getBoundingClientRect();
      const top = first.getBoundingClientRect().top;
      const r = {
        top,
        bottom: Math.min(
          last.getBoundingClientRect().bottom,
          top + box.height - 48,
        ),
      };
      if (r.top < box.top) {
        this.host.scrollTop -= box.top - r.top + 24;
      } else if (r.bottom > box.bottom) {
        this.host.scrollTop += r.bottom - box.bottom + 24;
      }
    });
  }

  /** The file's name; with its folder where the group has two of that name. */
  protected shortName(g: GroupView, path: string): string {
    const name = basename(path);
    const twins = g.files.filter((f) => basename(f.path) === name).length;
    if (twins < 2) {
      return name;
    }
    const dirs = path.split("/");
    return dirs.slice(-2).join("/");
  }

  protected count(g: GroupView): number {
    return tickedCount(
      g.files.map((f) => f.path),
      this.ticked(),
    );
  }
}
