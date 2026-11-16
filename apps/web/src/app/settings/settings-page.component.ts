import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from "@angular/core";
import { messageOf } from "../core/format";
import { SettingsService } from "../core/settings.service";
import { IconComponent } from "../ui/icon.component";
import { CredentialsFormComponent } from "./credentials-form.component";
import { KeptSettingsComponent } from "./kept-settings.component";
import { StoredDataComponent } from "./stored-data.component";

/** The user's credentials and what the app keeps in their browser (D22). */
@Component({
  selector: "rr-settings-page",
  imports: [
    CredentialsFormComponent,
    IconComponent,
    KeptSettingsComponent,
    StoredDataComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-3xl px-4 py-12">
      <h1 class="text-3xl font-semibold tracking-tight">Settings</h1>
      <p class="mt-2 text-stone-600 dark:text-stone-400">
        ripple-review runs in your browser. Your token and key stay here and go
        only to GitHub and Anthropic, straight from this browser; there is no
        ripple-review server.
      </p>

      <rr-credentials-form class="mt-8 block" />

      <section class="mt-16 border-t border-stone-200 pt-8 dark:border-stone-800">
        <h2 class="flex items-center gap-2 font-semibold">
          <rr-icon name="device" class="text-stone-500" /> Stored on this device
        </h2>
        <p class="mt-1 text-sm text-stone-600 dark:text-stone-400">
          Nothing is stored on a server. This browser keeps what is listed here; delete what you no longer need.
        </p>

        <rr-stored-data />

        <h3 class="mt-6 text-sm font-semibold">Token, key and start page</h3>
        <rr-kept-settings class="mt-3 block" />

        <p class="mt-6 text-sm text-stone-600 dark:text-stone-400">Clearing everything removes all of the above, the token and key included.</p>
        <button
          type="button"
          (click)="clear()"
          class="mt-3 flex items-center gap-2 rounded-md border border-rose-300 px-3 py-2 text-sm text-rose-800 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
        >
          <rr-icon name="delete" /> Clear everything
        </button>
        @if (clearError()) {
          <p class="mt-2 text-sm text-rose-700 dark:text-rose-300">{{ clearError() }}</p>
        }
      </section>
    </div>
  `,
})
export class SettingsPageComponent {
  private readonly settings = inject(SettingsService);
  protected readonly clearError = signal<string | undefined>(undefined);

  protected async clear(): Promise<void> {
    if (
      !confirm(
        "Remove your token, key, ticks, drafts and cached data from this browser?",
      )
    ) {
      return;
    }
    try {
      await this.settings.clearAll();
      // A fresh start: the engine's worker reopens an empty database.
      location.assign("/");
    } catch (err) {
      this.clearError.set(`Couldn't clear: ${messageOf(err)}`);
    }
  }
}
