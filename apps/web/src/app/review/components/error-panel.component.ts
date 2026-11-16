import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { RouterLink } from "@angular/router";
import { IconComponent } from "../../ui/icon.component";

/** A failure the user can read, with what to do about it. */
@Component({
  selector: "rr-error-panel",
  imports: [IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex gap-3 rounded-lg border border-rose-300 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/40" role="alert">
      <rr-icon name="error" class="text-rose-700 dark:text-rose-300" />
      <div>
        <p class="font-medium text-rose-900 dark:text-rose-200">{{ message() }}</p>
        @if (hint()) {
          <p class="mt-1 text-sm text-rose-800 dark:text-rose-300">{{ hint() }}</p>
        }
        <p class="mt-3 flex gap-4 text-sm">
          @if (status() === 401 || status() === 503) {
            <a routerLink="/settings" class="underline">Settings</a>
          }
          <a routerLink="/" class="underline">Back to the start</a>
        </p>
      </div>
    </div>
  `,
})
export class ErrorPanelComponent {
  readonly message = input.required<string>();
  readonly hint = input<string>();
  /** 401 (GitHub token) and 503 (AI key) link to the settings. */
  readonly status = input<number>();
}
