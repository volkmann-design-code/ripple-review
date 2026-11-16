import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from "@angular/core";
import { DraftsStore } from "../drafts.store";
import { anchorLabel, anchorOf, type Notes } from "../notes";
import { CommentFormComponent } from "./comment-form.component";
import { CommentThreadComponent } from "./comment-thread.component";
import { DraftCommentComponent } from "./draft-comment.component";

/** The threads, drafts and new comment's form at one place of a diff. */
@Component({
  selector: "rr-notes",
  imports: [
    CommentFormComponent,
    CommentThreadComponent,
    DraftCommentComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-3xl space-y-2 font-sans">
      @for (t of notes().threads; track t.id) {
        <rr-comment-thread [thread]="t" [withPlace]="withPlace()" />
      }
      @for (d of notes().drafts; track d.id) {
        <rr-draft-comment [draft]="d" [withPlace]="withPlace()" />
      }
      @if (notes().form) {
        <div class="rounded-md border border-stone-200 bg-white px-3 py-2 dark:border-stone-700 dark:bg-stone-900">
          <rr-comment-form
            [label]="formLabel()"
            [busy]="drafts.saving()"
            (save)="drafts.add($event)"
            (cancel)="drafts.cancel()"
          />
          @if (drafts.error(); as err) {
            <p class="mt-2 font-sans text-sm text-rose-700 dark:text-rose-300">{{ err.message }}@if (err.hint) { — {{ err.hint }}}</p>
          }
        </div>
      }
    </div>
  `,
})
export class NotesComponent {
  protected readonly drafts = inject(DraftsStore);
  readonly notes = input.required<Notes>();
  /** Shown above the diff: each says which lines it is on. */
  readonly withPlace = input(false);

  protected readonly formLabel = computed(() => {
    const c = this.drafts.composing();
    return c ? `Comment on ${anchorLabel(anchorOf(c))}` : "Comment";
  });
}
