import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from "@angular/core";
import type {
  ChangeRef,
  PullRequestSummary,
  RecentChange,
} from "@ripple-review/api-contract";
import { EngineService } from "../../core/engine.service";
import { buildStacks, progressIn, stackOf } from "../../core/stacks";
import { PullTreeComponent } from "../../ui/pull-tree.component";

/**
 * At the bottom of the sidebar on wide screens (the outline above it);
 * on narrow ones, on its own above the groups.
 */
const HOST =
  "mb-4 block shrink-0 lg:sticky lg:bottom-0 lg:mt-auto lg:mb-0 lg:border-t lg:border-stone-200 lg:bg-stone-50 lg:pt-3 lg:pb-2 lg:dark:border-stone-800 lg:dark:bg-stone-950";

/**
 * The stack the pull request is in, if any, with the reviewer's progress on
 * each; its own as ticked now. Extra: without it (no token yet, an error),
 * the page is the same.
 */
@Component({
  selector: "rr-review-stack",
  imports: [PullTreeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class]": "stack() ? HOST : 'hidden'",
    role: "region",
    "aria-labelledby": "stack-heading",
  },
  template: `
    @if (stack(); as s) {
      <h2 id="stack-heading" class="px-2 text-xs font-medium text-stone-500">
        In a stack of {{ s.rows.length }}: review from the top down
      </h2>
      <rr-pull-tree
        class="mt-1 block max-h-[40vh] overflow-y-auto"
        [stacks]="[s]"
        [owner]="ref().owner"
        [repo]="ref().repo"
        [current]="ref().number"
        [progress]="progress()"
        [showAuthor]="false"
      />
    }
  `,
})
export class ReviewStackComponent {
  private readonly api = inject(EngineService);
  protected readonly HOST = HOST;

  readonly ref = input.required<ChangeRef>();
  /** This pull request's files and how many are ticked, once it is read. */
  readonly files = input<number>();
  readonly ticked = input(0);

  /** The repository's open pull requests and those opened here. */
  private readonly pulls = signal<PullRequestSummary[]>([]);
  private readonly recent = signal<RecentChange[]>([]);

  protected readonly stack = computed(() =>
    stackOf(buildStacks(this.pulls()), this.ref().number),
  );
  protected readonly progress = computed(() => {
    const ref = this.ref();
    const map = progressIn(this.recent(), ref.owner, ref.repo);
    const files = this.files();
    if (files !== undefined) {
      map.set(ref.number, {
        ref,
        openedAt: "",
        files,
        ticked: this.ticked(),
      });
    }
    return map;
  });

  constructor() {
    effect(() => void this.load(this.ref()));
  }

  private async load(ref: ChangeRef): Promise<void> {
    const [pulls, recent] = await Promise.all([
      this.api.pulls(ref.owner, ref.repo).catch(() => []),
      this.api.recent().catch(() => []),
    ]);
    if (this.ref() === ref) {
      this.pulls.set(pulls);
      this.recent.set(recent);
    }
  }
}
