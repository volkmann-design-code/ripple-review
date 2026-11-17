import type { FrameworkRule } from "@ripple-review/core/framework";
import { Angular } from "./angular/angular.ts";
import { GraphileMigrate } from "./graphile-migrate/graphile-migrate.ts";
import { GraphileWorker } from "./graphile-worker/graphile-worker.ts";

export { Angular, GraphileMigrate, GraphileWorker };

/** All framework rules; each finds out itself whether the repository uses its framework. */
export function frameworkRules(): FrameworkRule[] {
  return [new Angular(), new GraphileMigrate(), new GraphileWorker()];
}
