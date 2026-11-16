import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";

/** A textarea to write or change a comment; Ctrl/⌘+Enter saves, Escape cancels. */
@Component({
  selector: "rr-comment-form",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="space-y-2" (submit)="$event.preventDefault(); send()">
      <label class="block text-xs text-stone-500" [attr.for]="id">{{ label() }}</label>
      <textarea
        #box
        [id]="id"
        rows="3"
        class="block w-full resize-y rounded-md border border-stone-300 bg-white px-2 py-1.5 font-sans text-sm text-stone-900 focus:border-teal-600 focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
        [value]="text()"
        (input)="text.set(box.value)"
        (keydown.control.enter)="send()"
        (keydown.meta.enter)="send()"
        (keydown.escape)="cancel.emit()"
      ></textarea>
      <div class="flex items-center gap-2 font-sans">
        <button
          type="submit"
          [disabled]="busy() || !text().trim()"
          class="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-50"
        >{{ busy() ? "Saving …" : saveLabel() }}</button>
        <button
          type="button"
          (click)="cancel.emit()"
          class="rounded-md px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
        >Cancel</button>
      </div>
    </form>
  `,
})
export class CommentFormComponent {
  private static next = 0;
  protected readonly id = `comment-${++CommentFormComponent.next}`;
  /** What the comment is on, e.g. "Comment on lines 3–5". */
  readonly label = input.required<string>();
  readonly initial = input("");
  readonly saveLabel = input("Add draft");
  readonly busy = input(false);
  readonly save = output<string>();
  readonly cancel = output();

  protected readonly text = signal("");
  private readonly box =
    viewChild.required<ElementRef<HTMLTextAreaElement>>("box");

  constructor() {
    afterNextRender(() => {
      this.text.set(this.initial());
      this.box().nativeElement.focus();
    });
  }

  protected send(): void {
    if (!this.busy() && this.text().trim()) {
      this.save.emit(this.text());
    }
  }
}
