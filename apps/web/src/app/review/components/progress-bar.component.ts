import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";

/** How many files are reviewed, as text and a bar. */
@Component({
  selector: "rr-progress-bar",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="text-sm font-medium">{{ done() }} / {{ total() }} files reviewed</p>
    <div class="mt-1 h-1.5 w-48 overflow-hidden rounded bg-stone-200 dark:bg-stone-800">
      <div class="h-full bg-teal-600 transition-all" [style.width.%]="percent()"></div>
    </div>
  `,
  host: { class: "block text-right" },
})
export class ProgressBarComponent {
  readonly done = input.required<number>();
  readonly total = input.required<number>();
  protected readonly percent = computed(() =>
    this.total() ? Math.round((this.done() / this.total()) * 100) : 0,
  );
}
