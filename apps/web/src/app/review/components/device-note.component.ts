import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import { IconComponent } from "../../ui/icon.component";

/** That the review is saved on this device, and whether this one came from there. */
@Component({
  selector: "rr-device-note",
  imports: [IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="flex items-start gap-1.5 text-sm text-stone-500">
      <rr-icon name="device" size="sm" class="mt-0.5" />
      <span>
        @if (savedAt(); as at) {
          Saved on this device {{ at }}; the diff hasn't changed since, so it
          wasn't analysed{{ ai() ? " or sent to the AI" : "" }} again.
        } @else {
          Saved on this device: reopening it shows this review at once while the
          diff stays the same.
        }
        <a routerLink="/settings" class="underline hover:text-stone-800 dark:hover:text-stone-200">What's stored</a>
      </span>
    </p>
  `,
})
export class DeviceNoteComponent {
  /** When the shown review was saved, if it was read back from the device. */
  readonly restoredAt = input<string>();
  readonly ai = input(false);

  protected readonly savedAt = computed(() => {
    const at = this.restoredAt();
    return at
      ? new Date(at).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : undefined;
  });
}
