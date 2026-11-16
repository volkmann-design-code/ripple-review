import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import type { ReviewEvent } from "@ripple-review/api-contract";
import { IconComponent } from "../../ui/icon.component";
import { DraftsStore } from "../drafts.store";

const EVENT_LABELS: Record<ReviewEvent, { label: string; hint: string }> = {
  comment: { label: "Comment", hint: "Feedback without approving" },
  approve: { label: "Approve", hint: "Ready to merge" },
  "request-changes": {
    label: "Request changes",
    hint: "Has to be addressed before merging",
  },
};

/** The reviewer's review on the forge: draft count, summary, and how to submit it. */
@Component({
  selector: "rr-review-panel",
  imports: [IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { "(document:keydown.escape)": "open.set(false)" },
  template: `
    @if (drafts.state(); as s) {
      <section class="relative" aria-label="Your review">
        <div class="flex h-11 items-center gap-3 rounded-lg border border-stone-200 bg-white px-3 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <rr-icon name="review" size="sm" class="text-stone-500" />
          <p class="min-w-0 flex-1 truncate text-sm">
            @if (s.drafts.length) {
              <span class="font-medium">Your pending review</span>
              <span class="ml-1 text-stone-500">· {{ s.drafts.length }} draft {{ s.drafts.length === 1 ? "comment" : "comments" }}</span>
            } @else {
              <span class="font-medium">Review</span>
              <span class="ml-1 text-stone-500">· no drafts yet: “+” on a line to comment</span>
            }
            <span class="text-stone-500">
              @if (s.threads.length) {
                · {{ s.threads.length }} earlier {{ s.threads.length === 1 ? "thread" : "threads" }}
              }
            </span>
          </p>
          @if (drafts.submitted(); as how) {
            <span class="hidden items-center gap-1 text-sm text-teal-800 sm:inline-flex dark:text-teal-300" role="status">
              <rr-icon name="done" size="sm" />
              Submitted as “{{ labels[how].label }}”
              @if (url()) {
                · <a [href]="url()" target="_blank" rel="noopener" class="underline">on {{ s.forge }}</a>
              }
            </span>
          }
          @if (!s.sync.synced) {
            <button type="button" (click)="open.set(true)" class="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200" title="Not everything reached {{ s.forge }}: open for details">
              <rr-icon name="sync-problem" size="xs" /> Not on {{ s.forge }} yet
            </button>
          }
          <button
            type="button"
            (click)="open.set(!open())"
            [attr.aria-expanded]="open()"
            class="inline-flex shrink-0 items-center gap-1 rounded-md bg-teal-700 px-3 py-1 text-sm font-medium text-white hover:bg-teal-600"
          >
            {{ s.drafts.length ? "Finish your review" : "Write a review" }}
            <rr-icon [name]="open() ? 'chevron-down' : 'chevron-right'" size="sm" />
          </button>
        </div>
        @if (open()) {
          <div class="absolute inset-x-0 top-full mt-1 max-h-[calc(100vh-9rem)] overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-lg dark:border-stone-800 dark:bg-stone-900">
          @if (!s.sync.synced) {
            <div class="mx-4 mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200" role="status">
              <p class="flex items-start gap-1.5">
                <rr-icon name="sync-problem" size="sm" class="mt-0.5" />
                <span>{{ s.sync.error }}. Drafts it didn't take stay in this browser and are sent on the next try.</span>
              </p>
              @if (s.sync.hint) {
                <p class="mt-1 text-amber-800 dark:text-amber-300">{{ s.sync.hint }}</p>
              }
              @if (s.sync.status === 401 || s.sync.status === 403) {
                <a routerLink="/settings" class="mt-1 inline-block underline">Settings</a>
              }
            </div>
          }
          <p class="px-4 pt-3 text-xs text-stone-500">
            @if (s.drafts.length) {
              Your {{ s.drafts.length }} {{ s.drafts.length === 1 ? "draft is" : "drafts are" }} in your pending review on {{ s.forge }}: only you see them until you submit.
            } @else {
              No line comments: the review is the summary alone (or an approval).
            }
          </p>
          <form class="space-y-3 px-4 pt-2 pb-3" (submit)="$event.preventDefault(); submit()">
            <label class="block text-sm" for="review-summary">
              Summary <span class="text-stone-500">(kept in this browser until you submit)</span>
            </label>
            <textarea
              id="review-summary"
              rows="4"
              class="block w-full resize-y rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm focus:border-teal-600 focus:outline-none dark:border-stone-700 dark:bg-stone-950"
              [value]="drafts.summary()"
              (input)="drafts.setSummary(summary.value)"
              #summary
            ></textarea>
            <fieldset class="space-y-1.5">
              <legend class="sr-only">How to submit</legend>
              @for (e of s.events; track e) {
                <label class="flex items-start gap-2 text-sm">
                  <input type="radio" name="review-event" class="mt-1 accent-teal-600" [checked]="event() === e" (change)="chosen.set(e)" />
                  <span><span class="font-medium">{{ labels[e].label }}</span><span class="ml-1.5 text-stone-500">{{ labels[e].hint }}</span></span>
                </label>
              }
              @if (s.events.length === 1) {
                <p class="text-xs text-stone-500">It's your own pull request: {{ s.forge }} lets you comment only.</p>
              }
            </fieldset>
            @if (drafts.error(); as err) {
              @if (!drafts.composing()) {
                <p class="text-sm text-rose-700 dark:text-rose-300">{{ err.message }}@if (err.hint) { — {{ err.hint }}}</p>
              }
            }
            <button
              type="submit"
              [disabled]="drafts.saving() || !canSubmit()"
              class="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-300"
            >{{ drafts.saving() ? "Submitting …" : "Submit review" }}</button>
          </form>
          </div>
        }
      </section>
    }
  `,
})
export class ReviewPanelComponent {
  protected readonly drafts = inject(DraftsStore);
  /** The change on the forge, to link to the submitted review. */
  readonly url = input<string>();
  protected readonly open = signal(false);
  protected readonly labels = EVENT_LABELS;
  protected readonly chosen = signal<ReviewEvent>("comment");

  /** The chosen event, if the forge offers it here; else the first offered. */
  protected readonly event = computed(() => {
    const events = this.drafts.state()?.events ?? [];
    return events.includes(this.chosen()) ? this.chosen() : events[0];
  });

  /** A comment needs something to say; approving doesn't. */
  protected readonly canSubmit = computed(() => {
    const e = this.event();
    const s = this.drafts.state();
    return (
      e !== undefined &&
      (e === "approve" ||
        this.drafts.summary().trim() !== "" ||
        (s?.drafts.length ?? 0) > 0)
    );
  });

  protected async submit(): Promise<void> {
    const e = this.event();
    if (e && (await this.drafts.submit(e))) {
      this.open.set(false);
    }
  }
}
