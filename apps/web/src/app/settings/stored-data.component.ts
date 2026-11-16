import {
  ChangeDetectionStrategy,
  Component,
  inject,
  type OnInit,
  signal,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import type {
  Forgettable,
  StoredChange,
  StoredData,
} from "@ripple-review/api-contract";
import { EngineService } from "../core/engine.service";
import { count, messageOf, size } from "../core/format";
import { labelOf, routeOf } from "../core/refs";
import { IconComponent } from "../ui/icon.component";
import { lossesOf, metaOf, partsOf, unsentOf } from "./stored-change";

const FORGE = "GitHub";

/** What the engine keeps in this browser: per pull request, and shared by all; each deletable. */
@Component({
  selector: "rr-stored-data",
  imports: [IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h3 class="mt-6 text-sm font-semibold">Pull requests</h3>
    <p class="mt-1 text-sm text-stone-600 dark:text-stone-400">
      Per pull request: its saved reviews (reopening it with the same diff shows them at once), your ticks
      and AI choice, the AI's answers (asking again costs nothing), and a review summary or draft comments
      {{ FORGE }} hasn't taken yet.
    </p>
    @if (stored(); as s) {
      @if (s.changes.length) {
        <ul class="mt-3 divide-y divide-stone-200 rounded-md border border-stone-200 dark:divide-stone-800 dark:border-stone-800">
          @for (c of s.changes; track label(c)) {
            <li class="flex items-center gap-3 px-3 py-2">
              <div class="min-w-0 flex-1">
                <a [routerLink]="route(c)" class="block truncate hover:underline">{{ c.title ?? label(c) }}</a>
                @if (meta(c); as m) {
                  <p class="truncate text-xs text-stone-500">{{ m }}</p>
                }
                <p class="text-xs text-stone-500">{{ parts(c) }}</p>
                @if (c.waitingDrafts || c.summary) {
                  <p class="mt-0.5 flex items-center gap-1 text-xs text-amber-800 dark:text-amber-300">
                    <rr-icon name="sync-problem" size="xs" /> Only here: deleting loses {{ unsent(c) }}.
                  </p>
                }
              </div>
              <span class="shrink-0 text-xs tabular-nums text-stone-500">{{ size(c.size) }}</span>
              <button type="button" class="icon-button" [disabled]="busy()" (click)="forgetChange(c)" [attr.aria-label]="'Delete what is kept of ' + label(c)" title="Delete">
                <rr-icon name="delete" size="sm" />
              </button>
            </li>
          }
        </ul>
      } @else {
        <p class="mt-3 text-sm text-stone-500">None yet.</p>
      }

      <h3 class="mt-6 text-sm font-semibold">Shared by all pull requests</h3>
      <ul class="mt-3 divide-y divide-stone-200 rounded-md border border-stone-200 dark:divide-stone-800 dark:border-stone-800">
        <li class="flex items-center gap-3 px-3 py-2">
          <div class="min-w-0 flex-1">
            <p>File contents <span class="text-sm text-stone-500">· {{ count(s.files.count, "file") }}</span></p>
            <p class="text-xs text-stone-500">Files already read, by content: later reviews of a repository fetch only what changed.</p>
          </div>
          <span class="shrink-0 text-xs tabular-nums text-stone-500">{{ size(s.files.size) }}</span>
          <button type="button" class="icon-button" [disabled]="busy() || !s.files.count" (click)="forget({ kind: 'files' })" aria-label="Delete the file contents" title="Delete">
            <rr-icon name="delete" size="sm" />
          </button>
        </li>
        @if (s.otherAiAnswers.count) {
          <li class="flex items-center gap-3 px-3 py-2">
            <div class="min-w-0 flex-1">
              <p>Other AI answers <span class="text-sm text-stone-500">· {{ count(s.otherAiAnswers.count, "answer") }}</span></p>
              <p class="text-xs text-stone-500">Saved before answers were kept per pull request.</p>
            </div>
            <span class="shrink-0 text-xs tabular-nums text-stone-500">{{ size(s.otherAiAnswers.size) }}</span>
            <button type="button" class="icon-button" [disabled]="busy()" (click)="forget({ kind: 'other-ai-answers' })" aria-label="Delete the other AI answers" title="Delete">
              <rr-icon name="delete" size="sm" />
            </button>
          </li>
        }
      </ul>
    } @else if (!error()) {
      <p class="mt-3 text-sm text-stone-500">Reading …</p>
    }
    @if (error()) {
      <p class="mt-3 text-sm text-rose-700 dark:text-rose-300">{{ error() }}</p>
    }
  `,
})
export class StoredDataComponent implements OnInit {
  private readonly api = inject(EngineService);

  protected readonly stored = signal<StoredData | undefined>(undefined);
  protected readonly error = signal<string | undefined>(undefined);
  protected readonly busy = signal(false);
  protected readonly FORGE = FORGE;
  protected readonly size = size;
  protected readonly count = count;
  protected readonly meta = metaOf;
  protected readonly parts = partsOf;

  ngOnInit(): void {
    void this.load();
  }

  protected label(c: StoredChange): string {
    return labelOf(c.ref);
  }

  protected route(c: StoredChange): string[] {
    return routeOf(c.ref);
  }

  protected unsent(c: StoredChange): string {
    return unsentOf(c, FORGE);
  }

  protected async forgetChange(c: StoredChange): Promise<void> {
    const loses = lossesOf(c, FORGE);
    if (
      loses &&
      !confirm(`Delete what is kept of ${this.label(c)}, with ${loses}?`)
    ) {
      return;
    }
    await this.forget({ kind: "change", ref: c.ref });
  }

  protected async forget(what: Forgettable): Promise<void> {
    this.busy.set(true);
    try {
      await this.api.forget(what);
      await this.load();
    } catch (err) {
      this.error.set(`Couldn't delete: ${messageOf(err)}`);
    } finally {
      this.busy.set(false);
    }
  }

  private async load(): Promise<void> {
    try {
      this.stored.set(await this.api.stored());
      this.error.set(undefined);
    } catch (err) {
      this.error.set(`Couldn't read what is stored: ${messageOf(err)}`);
    }
  }
}
