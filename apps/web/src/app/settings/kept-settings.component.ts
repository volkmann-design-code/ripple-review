import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from "@angular/core";
import { forgetLastRepo, lastRepo } from "../core/last-repo";
import { SettingsService } from "../core/settings.service";

type Kept = "githubToken" | "anthropicKey" | "lastRepo";

/** The token, key and last repository kept, and where; each can be forgotten. */
@Component({
  selector: "rr-kept-settings",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="divide-y divide-stone-200 rounded-md border border-stone-200 dark:divide-stone-800 dark:border-stone-800">
      @for (c of kept(); track c.key) {
        <li class="flex items-center gap-3 px-3 py-2">
          <div class="min-w-0 flex-1">
            <p>{{ c.label }}</p>
            <p class="text-xs text-stone-500">{{ c.where }}</p>
          </div>
          <button type="button" class="rounded-md border border-stone-300 px-2 py-1 text-sm hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800" (click)="forget(c.key)">Forget</button>
        </li>
      } @empty {
        <li class="px-3 py-2 text-sm text-stone-500">No token, key or repository kept.</li>
      }
    </ul>
  `,
})
export class KeptSettingsComponent {
  private readonly settings = inject(SettingsService);
  private readonly repo = signal(lastRepo());

  protected readonly kept = computed(() => {
    const s = this.settings.settings();
    const where = this.settings.remembered()
      ? "On this device"
      : "Until this tab closes";
    const repo = this.repo();
    const rows: { key: Kept; label: string; where: string }[] = [];
    if (s.githubToken) {
      rows.push({ key: "githubToken", label: "GitHub token", where });
    }
    if (s.anthropicKey) {
      rows.push({ key: "anthropicKey", label: "Anthropic API key", where });
    }
    if (repo) {
      rows.push({
        key: "lastRepo",
        label: `Last repository listed: ${repo}`,
        where: "On this device, for the start page",
      });
    }
    return rows;
  });

  protected forget(key: Kept): void {
    if (key === "lastRepo") {
      forgetLastRepo();
      this.repo.set(undefined);
    } else {
      this.settings.forget(key);
    }
  }
}
