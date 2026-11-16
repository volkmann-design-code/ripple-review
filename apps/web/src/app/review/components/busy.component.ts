import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { IconComponent } from "../../ui/icon.component";

/** Something in progress: a spinner, what is happening, how long it has taken. */
@Component({
  selector: "rr-busy",
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400" role="status">
      <rr-icon name="spinner" size="sm" class="animate-spin text-teal-600" />
      <span class="min-w-0 flex-1">{{ stage() ?? fallback() }}</span>
      <span class="tabular-nums text-xs text-stone-400">{{ seconds() }} s</span>
    </div>
  `,
})
export class BusyComponent {
  readonly stage = input<string>();
  readonly fallback = input("Working …");
  readonly seconds = input(0);
}
