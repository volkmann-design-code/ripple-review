import type { Routes } from "@angular/router";

export const routes: Routes = [
  {
    path: "",
    title: "ripple-review",
    loadComponent: () =>
      import("./start/start-page.component").then((m) => m.StartPageComponent),
  },
  {
    path: "settings",
    title: "Settings · ripple-review",
    loadComponent: () =>
      import("./settings/settings-page.component").then(
        (m) => m.SettingsPageComponent,
      ),
  },
  {
    // Mirrors github.com/<owner>/<repo>/pull/<n>: swap the host to open a PR here.
    path: ":owner/:repo/pull/:number",
    loadComponent: () =>
      import("./review/review-page.component").then(
        (m) => m.ReviewPageComponent,
      ),
  },
  { path: "**", redirectTo: "" },
];
