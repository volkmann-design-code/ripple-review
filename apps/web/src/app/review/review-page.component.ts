import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  Injector,
  inject,
  input,
} from "@angular/core";
import { Title } from "@angular/platform-browser";
import type { ChangeRef } from "@ripple-review/api-contract";
import { labelOf } from "../core/refs";
import { AiSummaryComponent } from "./components/ai-summary.component";
import { BusyComponent } from "./components/busy.component";
import { DeviceNoteComponent } from "./components/device-note.component";
import { ErrorPanelComponent } from "./components/error-panel.component";
import { fileId, GroupCardComponent } from "./components/group-card.component";
import { GroupOutlineComponent } from "./components/group-outline.component";
import { ReviewHeaderComponent } from "./components/review-header.component";
import { ReviewPanelComponent } from "./components/review-panel.component";
import { ReviewStackComponent } from "./components/review-stack.component";
import { ViewedSyncComponent } from "./components/viewed-sync.component";
import { DraftsStore } from "./drafts.store";
import { ReviewStore } from "./review.store";
import type { GroupView } from "./review-model";
import { ScrollSpy, SpyDirective } from "./scroll-spy";

const REVIEW_BAR_REM = 3.5;
/** The app header, and the group header below it (files are under it). */
const APP_HEADER_REM = 3.5;
const GROUP_HEADER_REM = 2.75;

/** The review page: wires the route and the store to the components. */
@Component({
  selector: "rr-review-page",
  imports: [
    AiSummaryComponent,
    BusyComponent,
    DeviceNoteComponent,
    ErrorPanelComponent,
    GroupCardComponent,
    GroupOutlineComponent,
    ReviewHeaderComponent,
    ReviewPanelComponent,
    ReviewStackComponent,
    SpyDirective,
    ViewedSyncComponent,
  ],
  providers: [ReviewStore, DraftsStore, ScrollSpy],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-screen-2xl px-4 pb-24">
      @if (store.loading()) {
        <div class="mx-auto max-w-md py-24">
          <p class="mb-3 text-center text-lg">Reading {{ label() }}</p>
          <rr-busy [stage]="store.stage()" fallback="Starting …" [seconds]="store.elapsed()" />
        </div>
      }
      @if (store.error(); as err) {
        <rr-error-panel class="mx-auto mt-10 block max-w-2xl" [message]="err.message" [hint]="err.hint" [status]="err.status" />
      }
      @if (store.review(); as review) {
        <rr-review-header
          [label]="label()"
          [title]="review.title ?? label()"
          [url]="review.url"
          [done]="store.tickedCount()"
          [total]="store.fileCount()"
          [refined]="!!review.ai"
          [refining]="store.refining()"
          (refine)="store.refine()"
          (showStatic)="store.showStatic()"
        />
        <div class="mt-3 space-y-1">
          @if (store.viewedSync(); as sync) {
            <rr-viewed-sync class="block" [sync]="sync" />
          }
          <rr-device-note class="block" [restoredAt]="review.restored?.savedAt" [ai]="!!review.ai" />
        </div>
        @if (drafts.state()) {
          <!-- Sticks below the app header; groups and files stick below it (--review-bar). -->
          <rr-review-panel
            class="sticky top-14 z-[15] -mx-4 mt-3 block bg-stone-50/95 px-4 py-1.5 backdrop-blur dark:bg-stone-950/95"
            [url]="review.url"
          />
        }
        @if (store.refining()) {
          <rr-busy class="mt-4 block rounded-md border border-stone-200 bg-white px-4 py-2 dark:border-stone-800 dark:bg-stone-900"
            [stage]="store.stage()" fallback="Asking the model …" [seconds]="store.elapsed()" />
        }
        @if (review.ai; as ai) {
          <rr-ai-summary class="mt-4 block" [ai]="ai" />
        }
        @if (store.saveError(); as msg) {
          <p class="mt-3 text-sm text-rose-700 dark:text-rose-300">{{ msg }}</p>
        }
        <div class="mt-6 grid gap-8 lg:grid-cols-[18rem_1fr]">
          <!-- Outline on top, the stack at the bottom of the viewport; narrow screens show the stack alone. -->
          <aside class="flex min-w-0 flex-col self-start lg:sticky lg:top-[calc(5rem+var(--review-bar,0px))] lg:h-[calc(100vh-6rem-var(--review-bar,0px))]">
            <rr-group-outline
              class="hidden min-h-0 overflow-y-auto lg:mb-6 lg:block"
              [groups]="store.groups()"
              [ticked]="store.ticked()"
              [openGroups]="openGroups()"
              [activeFiles]="spy.files()"
              (select)="scrollTo($event)"
              (selectFile)="scrollToFile($event.group, $event.path)"
            />
            @if (ref(); as r) {
              <rr-review-stack [ref]="r" [files]="store.review() ? store.fileCount() : undefined" [ticked]="store.tickedCount()" />
            }
          </aside>
          <main class="min-w-0 space-y-6">
            @for (g of store.groups(); track g.id) {
              <rr-group-card
                [rrSpy]="{ group: g.id }"
                [group]="g"
                [collapsed]="store.collapsed().has(g.index)"
                [ticked]="store.ticked()"
                [expanded]="store.expanded()"
                (toggleCollapsed)="store.toggleCollapsed(g.index)"
                (tickAll)="store.tickAll(paths(g), $event)"
                (tick)="store.toggleTick($event)"
                (toggleFile)="store.toggleExpanded($event)"
              />
            }
          </main>
        </div>
      }
    </div>
  `,
})
export class ReviewPageComponent {
  protected readonly store = inject(ReviewStore);
  protected readonly drafts = inject(DraftsStore);
  private readonly title = inject(Title);
  protected readonly spy = inject(ScrollSpy);
  private readonly injector = inject(Injector);

  /** The groups on screen (the first before any is): open in the outline. */
  protected readonly openGroups = computed((): ReadonlySet<string> => {
    const on = this.spy.groups();
    const first = this.store.groups()[0]?.id;
    return on.size || !first ? on : new Set([first]);
  });

  // Route parameters (withComponentInputBinding).
  readonly owner = input<string>();
  readonly repo = input<string>();
  readonly number = input<string>();

  protected readonly ref = computed<ChangeRef | undefined>(() => {
    const owner = this.owner();
    const repo = this.repo();
    const n = Number(this.number());
    return owner && repo && Number.isInteger(n)
      ? { kind: "github", owner, repo, number: n }
      : undefined;
  });
  protected readonly label = computed(() => {
    const ref = this.ref();
    return ref ? labelOf(ref) : "";
  });

  constructor() {
    effect(() => {
      const ref = this.ref();
      if (ref) {
        // The threads and the reviewer's drafts load alongside the review.
        void this.store.load(ref);
        void this.drafts.load(ref);
      }
    });
    // The review bar's height, for what sticks below it and for anchors.
    const root = document.documentElement.style;
    effect(() => {
      const bar = this.drafts.state() ? REVIEW_BAR_REM : 0;
      if (bar) {
        root.setProperty("--review-bar", `${bar}rem`);
      } else {
        root.removeProperty("--review-bar");
      }
      // What is on screen: any part of it below the sticky headers.
      const rem =
        Number.parseFloat(
          getComputedStyle(document.documentElement).fontSize,
        ) || 16;
      const top = (APP_HEADER_REM + bar) * rem;
      this.spy.observe(
        Math.round(top),
        Math.round(top + GROUP_HEADER_REM * rem),
      );
    });
    inject(DestroyRef).onDestroy(() => root.removeProperty("--review-bar"));
    effect(() => {
      const title = this.store.review()?.title ?? this.label();
      this.title.setTitle(`${title} · ripple-review`);
    });
  }

  protected paths(g: GroupView): string[] {
    return g.files.map((f) => f.path);
  }

  /** Scrolls to a group; the CSS scroll padding keeps it below the app header. */
  protected scrollTo(g: GroupView): void {
    document.getElementById(g.id)?.scrollIntoView({ behavior: "smooth" });
  }

  /** Scrolls to a file, opening its group first if it is folded. */
  protected scrollToFile(g: GroupView, path: string): void {
    const n = g.files.find((f) => f.path === path)?.n;
    if (n === undefined) {
      return;
    }
    const go = () =>
      document
        .getElementById(fileId(n))
        ?.scrollIntoView({ behavior: "smooth" });
    if (this.store.collapsed().has(g.index)) {
      this.store.toggleCollapsed(g.index);
      afterNextRender(go, { injector: this.injector });
    } else {
      go();
    }
  }
}
