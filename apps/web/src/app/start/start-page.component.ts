import {
  ChangeDetectionStrategy,
  Component,
  inject,
  type OnInit,
  signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import type {
  PullRequestSummary,
  RecentChange,
} from "@ripple-review/api-contract";
import { EngineService } from "../core/engine.service";
import { parseRef, routeOf } from "../core/refs";
import { SettingsService } from "../core/settings.service";
import { RecentListComponent } from "./recent-list.component";
import { RepoPullsComponent } from "./repo-pulls.component";

/** Where to start: paste a pull request, reopen a recent one, or pick one of a repository. */
@Component({
  selector: "rr-start-page",
  imports: [FormsModule, RecentListComponent, RepoPullsComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-3xl px-4 py-12">
      <h1 class="text-3xl font-semibold tracking-tight">Review a pull request in order</h1>
      <p class="mt-2 text-stone-600 dark:text-stone-400">
        ripple-review splits a change into stories and orders them from the core (schema, contract, library)
        outwards to the code that uses it. Paste a pull request, or swap
        <code class="text-sm">github.com</code> for this app's address in a pull request's URL.
      </p>

      @if (!settings.hasGitHub()) {
        <p class="mt-6 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          To read pull requests, add a GitHub token in <a routerLink="/settings" class="underline">Settings</a>.
          It stays in this browser.
        </p>
      }

      <form class="mt-8 flex gap-2" (ngSubmit)="open()">
        <input
          name="ref"
          [(ngModel)]="refInput"
          placeholder="https://github.com/owner/repo/pull/123 or owner/repo#123"
          class="min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 dark:border-stone-700 dark:bg-stone-900"
          autofocus
        />
        <button type="submit" class="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-600">Open</button>
      </form>
      @if (refError()) {
        <p class="mt-2 text-sm text-rose-700 dark:text-rose-300">{{ refError() }}</p>
      }

      @if (recent().length) {
        <section class="mt-12">
          <h2 class="font-semibold">Recently viewed</h2>
          <rr-recent-list class="mt-3 block" [recent]="recent()" [pulls]="recentPulls()" />
        </section>
      }

      <section class="mt-12">
        <h2 class="font-semibold">Open pull requests of a repository</h2>
        <rr-repo-pulls class="mt-3 block" [recent]="recent()" />
      </section>
    </div>
  `,
})
export class StartPageComponent implements OnInit {
  private readonly api = inject(EngineService);
  protected readonly settings = inject(SettingsService);
  private readonly router = inject(Router);

  protected refInput = "";
  protected readonly refError = signal<string | undefined>(undefined);
  protected readonly recent = signal<RecentChange[]>([]);
  /** Open pull requests of the repositories in "Recently viewed", by `owner/repo`. */
  protected readonly recentPulls = signal<
    ReadonlyMap<string, PullRequestSummary[]>
  >(new Map());

  ngOnInit(): void {
    this.api.recent().then(
      (r) => {
        this.recent.set(r);
        void this.loadRecentPulls(r);
      },
      () => this.recent.set([]),
    );
  }

  protected open(): void {
    const ref = parseRef(this.refInput);
    if (!ref) {
      this.refError.set("That isn't a pull request URL or owner/repo#number.");
      return;
    }
    this.refError.set(undefined);
    void this.router.navigate(routeOf(ref));
  }

  /** Their repositories' open pull requests, for the stacks; without them, plain rows. */
  private async loadRecentPulls(recent: RecentChange[]): Promise<void> {
    if (!this.settings.hasGitHub()) {
      return;
    }
    const repos = [
      ...new Map(
        recent.map((c) => [`${c.ref.owner}/${c.ref.repo}`, c.ref]),
      ).entries(),
    ];
    const lists = await Promise.all(
      repos.map(([key, r]) =>
        this.api.pulls(r.owner, r.repo).then(
          (pulls) => [key, pulls] as const,
          () => undefined,
        ),
      ),
    );
    this.recentPulls.set(new Map(lists.filter((l) => l !== undefined)));
  }
}
