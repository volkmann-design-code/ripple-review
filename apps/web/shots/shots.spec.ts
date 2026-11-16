import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { addedLine, fakeGitHub } from "./fake-github";

/**
 * Screenshots of the real web app into `shots/out/` (gitignored): a review
 * in light and dark, a colleague's thread next to its line, the start page,
 * and a 1280×640 cover (the repository's social preview) made of the light
 * review. The window at 1440×900 and 2×; GitHub answered from a recorded
 * public pull request (fake-github.ts).
 *
 *   bunx nx run @ripple-review/web:shots
 */

const OUT = join(import.meta.dirname, "out");
const FIXTURE = join(import.meta.dirname, "../../cli/fixtures/spartan-1845");
const REPO = "spartan-ng/spartan";
const NUMBER = 1845;
const THREAD_FILE = "libs/brain/tooltip/src/lib/brn-tooltip.ts";

const pull = {
  dir: FIXTURE,
  repo: REPO,
  number: NUMBER,
  viewed: [
    "libs/brain/tooltip/src/lib/brn-tooltip-position.ts",
    "libs/brain/tooltip/src/lib/brn-tooltip.token.ts",
  ],
  threads: [
    {
      path: THREAD_FILE,
      line: addedLine(FIXTURE, THREAD_FILE, "public readonly sideOffset"),
      author: "lena-k",
      body: "Does `sideOffset` also apply to the fallback positions? A test for the flipped case would help.",
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
  await expect(page.getByText("brn-tooltip-position.ts").first()).toBeVisible();
  await settle(page);
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    await document.fonts.ready;
    (document.activeElement as HTMLElement | null)?.blur();
    window.getSelection()?.removeAllRanges();
  });
}

const shot = (page: Page, name: string, scale: "css" | "device" = "device") =>
  page.screenshot({
    path: join(OUT, `${name}.png`),
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
    .getByText("A test for the flipped case")
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
  await shot(page, "cover", "css");
});
