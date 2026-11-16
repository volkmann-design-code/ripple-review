import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from "@angular/core";
import type { DraftComment } from "@ripple-review/api-contract";
import { IconComponent } from "../../ui/icon.component";
import { DraftsStore } from "../drafts.store";
import { anchorLabel } from "../notes";
import { CommentFormComponent } from "./comment-form.component";

/** One of the reviewer's draft comments: in their pending review, or still only in the browser. */
@Component({
  selector: "rr-draft-comment",
  imports: [CommentFormComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-md border border-amber-300 bg-amber-50/60 px-3 py-2 font-sans dark:border-amber-900 dark:bg-amber-950/30">
      @if (editing()) {
        <rr-comment-form
          [label]="'Change the draft on ' + place()"
          [initial]="draft().body"
          saveLabel="Save"
          [busy]="drafts.saving()"
          (save)="save($event)"
          (cancel)="editing.set(false)"
        />
      } @else {
        <p class="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
          <span class="rounded bg-amber-200 px-1.5 font-medium dark:bg-amber-900">Draft</span>
          @if (withPlace()) {
            <span>on {{ place() }}</span>
          }
          <span class="text-amber-800 dark:text-amber-300">{{ draft().local ? "only in this browser, not on " + forge() + " yet" : "only you see it until you submit" }}</span>
          <span class="ml-auto flex gap-1">
            <button type="button" class="icon-button-sm" (click)="editing.set(true)" [disabled]="drafts.saving()" aria-label="Change the draft" title="Change">
              <rr-icon name="edit" size="xs" />
            </button>
            <button type="button" class="icon-button-sm" (click)="drafts.remove(draft().id)" [disabled]="drafts.saving()" aria-label="Delete the draft" title="Delete">
              <rr-icon name="delete" size="xs" />
            </button>
          </span>
        </p>
        <p class="mt-1 whitespace-pre-wrap break-words text-sm">{{ draft().body }}</p>
      }
    </div>
  `,
})
export class DraftCommentComponent {
  protected readonly drafts = inject(DraftsStore);
  readonly draft = input.required<DraftComment>();
  readonly withPlace = input(false);
  protected readonly editing = signal(false);
  protected readonly place = computed(() => anchorLabel(this.draft().anchor));
  protected readonly forge = computed(
    () => this.drafts.state()?.forge ?? "the forge",
  );

  protected async save(body: string): Promise<void> {
    if (await this.drafts.edit(this.draft().id, body)) {
      this.editing.set(false);
    }
  }
}
