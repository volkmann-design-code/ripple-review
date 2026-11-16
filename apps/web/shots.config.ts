import { defineConfig } from "@playwright/test";

const PORT = 4300;

/**
 * Screenshots of the real web app for the README, the repository's social
 * preview and anything else that shows the product (shots/shots.spec.ts):
 * the production build, with GitHub's API answered from a recorded fixture
 * (shots/fake-github.ts), so no token and the same pictures every time.
 * Not tests: `bunx nx run @ripple-review/web:shots`.
 */
export default defineConfig({
  testDir: "./shots",
  outputDir: "./shots/.results",
  reporter: [["list"]],
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: "chromium",
  },
  webServer: {
    command: `bun shots/serve.ts ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
  },
});
