import type { FrameworkRule } from "@ripple-review/core/framework";
import { GraphileMigrate } from "./graphile-migrate/graphile-migrate.ts";

export { GraphileMigrate };

/** All framework rules; each finds out itself whether the repository uses its framework. */
export function frameworkRules(): FrameworkRule[] {
  return [new GraphileMigrate()];
}
