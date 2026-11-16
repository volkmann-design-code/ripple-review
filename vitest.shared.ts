import type { ViteUserConfig } from "vitest/config";

/**
 * Shared Vitest config for every project (`vitest.config.ts` in each
 * project calls it). Run by Bun: `bun --bun vitest run src`.
 */
export function createVitestConfig(
  overrides?: Partial<ViteUserConfig["test"]>,
): ViteUserConfig {
  return {
    resolve: {
      // `@ripple-review/*` imports, from the root tsconfig.json `paths`.
      tsconfigPaths: true,
    },
    test: {
      environment: "node",
      // `default`'s progress lines don't survive Nx's task capture; `verbose`
      // does. `github-actions` adds failure annotations.
      reporters: process.env.CI ? ["verbose", "github-actions"] : ["default"],
      ...overrides,
    },
  };
}
