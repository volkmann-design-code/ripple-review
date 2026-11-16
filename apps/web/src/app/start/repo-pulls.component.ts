import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  type OnInit,
  signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import type {
  PullRequestSummary,
  RecentChange,
} from "@ripple-review/api-contract";
import { EngineService } from "../core/engine.service";
import { messageOf } from "../core/format";
import { lastRepo, setLastRepo } from "../core/last-repo";
import { parseRepo } from "../core/refs";
import { SettingsService } from "../core/settings.service";
import { buildStacks, progressIn } from "../core/stacks";
import { PullTreeComponent } from "../ui/pull-tree.component";

/** A repository's open pull requests as stacks; the last one listed comes back. */
@Component({
  selector: "rr-repo-pulls",
  imports: [FormsModule, PullTreeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="flex gap-2" (ngSubmit)="list()">
      <input
        name="repo"
        [(ngModel)]="repoInput"
        placeholder="owner/repo"
        class="min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 dark:border-stone-700 dark:bg-stone-900"
      />
      <button type="submit" class="rounded-md border border-stone-300 px-4 py-2 hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800">List</button>
    </form>
    @if (loading()) {
      <p class="mt-3 text-sm text-stone-500">Loading …</p>
    }
    @if (error()) {
      <p class="mt-3 text-sm text-rose-700 dark:text-rose-300">{{ error() }}</p>
    }
    @if (listed(); as l) {
      @if (l.pulls.length === 0) {
        <p class="mt-3 text-sm text-stone-500">No open pull requests.</p>
      } @else {
        <p class="mt-3 text-xs text-stone-500">
          A pull request on another's branch is drawn under it: review from the top down.
        </p>
        <rr-pull-tree
          class="mt-2 block rounded-md border border-stone-200 px-2 dark:border-stone-800"
          [stacks]="stacks()"
          [owner]="l.owner"
          [repo]="l.repo"
          [progress]="progress()"
        />
      }
    }
  `,
})
export class RepoPullsComponent implements OnInit {
  private readonly api = inject(EngineService);
  private readonly settings = inject(SettingsService);

  /** The changes opened here, for the reviewer's progress. */
  readonly recent = input<RecentChange[]>([]);

  protected repoInput = lastRepo() ?? "";
  protected readonly loading = signal(false);
  protected readonly error = signal<string | undefined>(undefined);
  /** The pull requests listed, and the repository they are of. */
  protected readonly listed = signal<
    { owner: string; repo: string; pulls: PullRequestSummary[] } | undefined
  >(undefined);
  protected readonly stacks = computed(() =>
    buildStacks(this.listed()?.pulls ?? []),
  );
  protected readonly progress = computed(() => {
    const l = this.listed();
    return l ? progressIn(this.recent(), l.owner, l.repo) : new Map();
  });

  ngOnInit(): void {
    if (this.repoInput && this.settings.hasGitHub()) {
      void this.list();
    }
  }

  protected async list(): Promise<void> {
    const repo = parseRepo(this.repoInput);
    if (!repo) {
      this.error.set("Enter a repository as owner/repo.");
      return;
    }
    this.error.set(undefined);
    this.loading.set(true);
    try {
      const pulls = await this.api.pulls(repo.owner, repo.repo);
      this.listed.set({ ...repo, pulls });
      setLastRepo(`${repo.owner}/${repo.repo}`);
    } catch (err) {
      this.listed.set(undefined);
      this.error.set(messageOf(err));
    } finally {
      this.loading.set(false);
    }
  }
}
