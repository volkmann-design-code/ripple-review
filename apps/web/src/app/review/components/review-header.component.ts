import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from "@angular/core";
import { IconComponent } from "../../ui/icon.component";
import { ProgressBarComponent } from "./progress-bar.component";

/** The pull request's title, its progress and the AI switch. */
@Component({
  selector: "rr-review-header",
  imports: [IconComponent, ProgressBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-end gap-x-6 gap-y-3 border-b border-stone-200 py-5 dark:border-stone-800">
      <div class="min-w-0 flex-1">
        <p class="flex items-center gap-1 text-sm text-stone-500">
          {{ label() }}
          @if (url()) {
            ·
            <a [href]="url()" target="_blank" rel="noopener" class="inline-flex items-center gap-0.5 underline hover:text-stone-800 dark:hover:text-stone-200">
              on GitHub <rr-icon name="external" size="xs" />
            </a>
          }
        </p>
        <h1 class="mt-1 text-2xl font-semibold tracking-tight">{{ title() }}</h1>
      </div>
      <div class="flex items-center gap-4">
        <rr-progress-bar [done]="done()" [total]="total()" />
        @if (refined()) {
          <button
            type="button"
            (click)="showStatic.emit()"
            class="rounded-md border border-stone-300 px-3 py-2 text-sm hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
            title="Back to the order of the static analysis alone"
          >Static order</button>
        } @else {
          <button
            type="button"
            (click)="refine.emit()"
            [disabled]="refining()"
            class="inline-flex items-center gap-1.5 rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-70 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-300"
            title="Let a model name the groups, refine their order and place files the analysis couldn't (sends a summary of the diff to the AI provider)"
          >
            <rr-icon [name]="refining() ? 'spinner' : 'ai'" size="sm" [class.animate-spin]="refining()" />
            {{ refining() ? "Refining …" : "Refine with AI" }}
          </button>
        }
      </div>
    </div>
  `,
})
export class ReviewHeaderComponent {
  readonly label = input.required<string>();
  readonly title = input.required<string>();
  readonly url = input<string>();
  readonly done = input.required<number>();
  readonly total = input.required<number>();
  readonly refined = input(false);
  readonly refining = input(false);
  readonly refine = output();
  readonly showStatic = output();
}
