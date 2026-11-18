import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { addedLine, fakeGitHub } from "./fake-github";

/**
 * Screenshots of the real web app into `shots/out/` (gitignored): a review
 * in light and dark, a colleague's thread next to its line, the start page;
 * and a 1280×640 cover made of the light review into `.github/cover.png`
 * (committed: the README's intro and the repository's social preview). The window at 1440×900 and 2×; GitHub answered from a recorded
 * public pull request (fake-github.ts).
 *
 *   bunx nx run @ripple-review/web:shots
 */

const OUT = join(import.meta.dirname, "out");
const COVER = join(import.meta.dirname, "../../../.github/cover.png");
const FIXTURE = join(
  import.meta.dirname,
  "../../cli/fixtures/graphile-starter-341",
);
const REPO = "graphile/starter";
const NUMBER = 341;
const THREAD_FILE = "@app/components/src/SharedLayout.tsx";
/** The group on screen: a story from a shared component out to its pages. */
const STORY = "SharedLayout.tsx";

const pull = {
  dir: FIXTURE,
  repo: REPO,
  number: NUMBER,
  // groups 1–4 reviewed, the story on screen begun
  viewed: [
    "README.md",
    ".editorconfig",
    ".eslintrc.js",
    "package.json",
    "tsconfig.json",
    "@app/client/src/styles.css",
    "@app/client/src/pages/_app.tsx",
    "@app/server/src/utils/handleErrors.ts",
    "@app/server/src/plugins/PassportLoginPlugin.ts",
    "@app/components/src/Redirect.tsx",
  ],
  threads: [
    {
      path: THREAD_FILE,
      line: addedLine(
        FIXTURE,
        THREAD_FILE,
        'data-cy="layout-header-titlelink"',
      ),
      author: "lena-k",
      body: "With Next 13 the `Link` renders the `<a>` itself: does the `data-cy` still reach it, or do the Cypress tests lose the title link?",
    },
  ],
};

test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
mkdirSync(OUT, { recursive: true });

/** A token for the fake GitHub, then the review, analysed and settled. */
async function openReview(page: Page) {
  await page.context().route("https://api.github.com/**", fakeGitHub(pull));
  await page.goto("/settings");
  await page.locator("#github-token").fill("demo");
  await page.getByRole("button", { name: "Save" }).click();
  await page.goto(`/${REPO}/pull/${NUMBER}`);
  const outline = page.getByRole("navigation", { name: "Groups and files" });
  await expect(outline.getByText("Repository config")).toBeVisible();
  await outline.getByRole("button", { name: new RegExp(STORY) }).click();
  await stopped(page);
  await settle(page);
}

/** Until the page stops scrolling (a jump scrolls smoothly). */
async function stopped(page: Page) {
  let last = -1;
  await expect
    .poll(async () => {
      const y = await page.evaluate(() => window.scrollY);
      const still = y === last && y > 0;
      last = y;
      return still;
    })
    .toBe(true);
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  // no hover left on what was clicked
  await page.mouse.move(0, 0);
  await page.evaluate(async () => {
    await document.fonts.ready;
    (document.activeElement as HTMLElement | null)?.blur();
    window.getSelection()?.removeAllRanges();
  });
}

const shot = (page: Page, name: string, scale: "css" | "device" = "device") =>
  page.screenshot({
    path: name.endsWith(".png") ? name : join(OUT, `${name}.png`),
    animations: "disabled",
    caret: "hide",
    scale,
  });

test("review", async ({ page }) => {
  await openReview(page);
  await shot(page, "review");
});

test.describe("dark", () => {
  test.use({ colorScheme: "dark" });
  test("review-dark", async ({ page }) => {
    await openReview(page);
    await shot(page, "review-dark");
  });
});

test("thread", async ({ page }) => {
  await openReview(page);
  // the thread in the middle, its line and the code around it in view
  await page
    .getByText("do the Cypress tests lose")
    .first()
    // instant: the page scrolls smoothly, a screenshot would catch it halfway
    .evaluate((el) =>
      el.scrollIntoView({ block: "center", behavior: "instant" }),
    );
  await settle(page);
  await shot(page, "thread");
});

test("start", async ({ page }) => {
  // the review first, so the start page lists it as recently viewed
  await openReview(page);
  await page.goto("/");
  await expect(page.getByText(`${REPO}#${NUMBER}`).first()).toBeVisible();
  await settle(page);
  await shot(page, "start");
});

test("cover", async ({ page }) => {
  await openReview(page);
  const review = (
    await page.screenshot({ animations: "disabled", caret: "hide" })
  ).toString("base64");
  const html = readFileSync(
    join(import.meta.dirname, "cover.html"),
    "utf8",
  ).replace("{{review}}", review);
  await page.setViewportSize({ width: 1280, height: 640 });
  await page.setContent(html);
  // a data URL of a few MB: decoded only after the load event
  await page
    .locator(".shot img")
    .evaluate((img: HTMLImageElement) => img.decode());
  await settle(page);
  // GitHub's social preview: 1280×640, under 1 MB
  await shot(page, COVER, "css");
});
