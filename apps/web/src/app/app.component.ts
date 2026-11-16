import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { IconComponent } from "./ui/icon.component";

@Component({
  selector: "rr-root",
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header
      class="sticky top-0 z-20 border-b border-stone-200 bg-stone-50/90 backdrop-blur dark:border-stone-800 dark:bg-stone-950/90"
    >
      <div class="mx-auto flex h-14 max-w-screen-2xl items-center gap-3 px-4">
        <a routerLink="/" class="font-semibold tracking-tight">
          <span class="text-teal-700 dark:text-teal-400">ripple</span>-review
        </a>
        <span class="hidden text-sm text-stone-500 sm:inline">read a change from its core outwards</span>
        <a
          routerLink="/settings"
          routerLinkActive="text-teal-700 dark:text-teal-400"
          class="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-sm text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-900"
        >
          <rr-icon name="settings" /> Settings
        </a>
      </div>
    </header>
    <router-outlet />
  `,
})
export class AppComponent {}
