import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { SettingsService } from "../core/settings.service";
import { IconComponent } from "../ui/icon.component";

const INPUT =
  "mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 font-mono text-sm dark:border-stone-700 dark:bg-stone-900";

/** The user's GitHub token and Anthropic key, and whether to keep them on this device. */
@Component({
  selector: "rr-credentials-form",
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="space-y-8" (ngSubmit)="save()">
      <section>
        <label for="github-token" class="flex items-center gap-2 font-semibold">
          <rr-icon name="key" class="text-stone-500" /> GitHub token
        </label>
        <p class="mt-1 text-sm text-stone-600 dark:text-stone-400">
          A
          <a class="underline" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">fine-grained token</a>
          with read access to <em>Contents</em> and <em>Pull requests</em> of the repositories you review.
          With write access to <em>Pull requests</em>, your ticks are also your “Viewed” marks on GitHub,
          and you can write and submit reviews from here.
        </p>
        <input
          id="github-token"
          name="githubToken"
          type="password"
          autocomplete="off"
          spellcheck="false"
          [(ngModel)]="githubToken"
          placeholder="github_pat_…"
          [class]="INPUT"
        />
      </section>

      <section>
        <label for="anthropic-key" class="flex items-center gap-2 font-semibold">
          <rr-icon name="ai" class="text-stone-500" /> Anthropic API key <span class="font-normal text-stone-500">(optional)</span>
        </label>
        <p class="mt-1 text-sm text-stone-600 dark:text-stone-400">
          For "Refine with AI": Claude names the groups and refines the order. The diff
          goes to Anthropic and the usage is billed to your key; answers are saved on
          this device, so asking again costs nothing.
          <a class="underline" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">Create a key</a>.
        </p>
        <input
          id="anthropic-key"
          name="anthropicKey"
          type="password"
          autocomplete="off"
          spellcheck="false"
          [(ngModel)]="anthropicKey"
          placeholder="sk-ant-…"
          [class]="INPUT"
        />
      </section>

      <label class="flex items-start gap-2 text-sm">
        <input type="checkbox" name="remember" [(ngModel)]="remember" class="mt-1" />
        <span>
          Remember on this device. Otherwise they are forgotten when this tab closes.
        </span>
      </label>

      <div class="flex items-center gap-3">
        <button type="submit" class="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-600">Save</button>
        @if (saved()) {
          <span class="flex items-center gap-1 text-sm text-teal-700 dark:text-teal-400" role="status">
            <rr-icon name="done" /> Saved
          </span>
        }
      </div>
    </form>
  `,
})
export class CredentialsFormComponent {
  private readonly settings = inject(SettingsService);
  protected readonly INPUT = INPUT;

  // The fields follow what is saved: forgetting one elsewhere empties it,
  // and leaves what is typed in the other (computed: only on a change).
  private readonly savedToken = computed(
    () => this.settings.settings().githubToken ?? "",
  );
  private readonly savedKey = computed(
    () => this.settings.settings().anthropicKey ?? "",
  );
  protected readonly githubToken = linkedSignal(() => this.savedToken());
  protected readonly anthropicKey = linkedSignal(() => this.savedKey());
  protected readonly remember = linkedSignal(() => this.settings.remembered());
  protected readonly saved = signal(false);

  protected save(): void {
    this.settings.save(
      { githubToken: this.githubToken(), anthropicKey: this.anthropicKey() },
      this.remember(),
    );
    this.saved.set(true);
  }
}
