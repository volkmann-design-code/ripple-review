import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { RouterLink } from "@angular/router";
import type { ViewedSync } from "@ripple-review/api-contract";
import { IconComponent } from "../../ui/icon.component";

/** Whether the ticks are the forge's "Viewed" marks, and what to do if not. */
@Component({
  selector: "rr-viewed-sync",
  imports: [IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sync().synced) {
      <p class="flex items-center gap-1.5 text-sm text-stone-500">
        <rr-icon name="synced" size="sm" />
        Ticks are your “Viewed” marks on {{ sync().forge }}.
      </p>
    } @else {
      <div class="flex gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950/40" role="status">
        <rr-icon name="sync-problem" size="sm" class="mt-0.5 text-amber-700 dark:text-amber-300" />
        <div class="text-amber-900 dark:text-amber-200">
          <p>{{ sync().error }}. Your ticks stay in this browser and are sent on the next try.</p>
          @if (sync().hint) {
            <p class="mt-1 text-amber-800 dark:text-amber-300">{{ sync().hint }}</p>
          }
          @if (sync().status === 401 || sync().status === 403) {
            <a routerLink="/settings" class="mt-1 inline-block underline">Settings</a>
          }
        </div>
      </div>
    }
  `,
})
export class ViewedSyncComponent {
  readonly sync = input.required<ViewedSync>();
}
