import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { review } from "@ripple-review/engine/review";
import { renderMarkdown } from "@ripple-review/report/markdown";
import { loadFixture } from "@ripple-review/sources/fixture";
import { describe, expect, it } from "vitest";

/*
 * Every recorded change (`ripple … --record apps/cli/fixtures/<name>`) against
 * its golden review order in `<name>/expected.md`. A change to the order shows
 * up as a diff of that file: review it, then accept it with
 * `bunx nx run @ripple-review/cli:test:unit -- -u`.
 *
 * Recordings of private repositories go to `local/fixtures/` (gitignored):
 * they run here too when present, so only CI goes without them.
 */
const DIRS = [
  join(import.meta.dirname, "../fixtures"),
  join(import.meta.dirname, "../../../local/fixtures"),
];

// A full review of a large recording takes a few seconds on a busy CI runner
// ("is deterministic" runs two); Vitest's default of 5 s is too tight.
const TIMEOUT = 30_000;

const FIXTURES = DIRS.filter((dir) => existsSync(dir)).flatMap((dir) =>
  readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({ name: e.name, dir: join(dir, e.name) }))
    .sort((a, b) => a.name.localeCompare(b.name)),
);

describe.each(FIXTURES)("fixture $name", { timeout: TIMEOUT }, ({ dir }) => {
  it("matches the golden review order", async () => {
    const cs = loadFixture(dir);
    const { groups } = await review(cs);
    await expect(renderMarkdown(cs, groups)).toMatchFileSnapshot(
      join(dir, "expected.md"),
    );
  });

  it("places every changed file exactly once", async () => {
    const cs = loadFixture(dir);
    const placed = (await review(cs)).groups.flatMap((g) =>
      g.items.map((i) => i.path),
    );
    expect(placed.sort()).toEqual(cs.files.map((f) => f.path).sort());
  });

  it("is deterministic", async () => {
    const run = async () =>
      JSON.stringify((await review(loadFixture(dir))).groups);
    expect(await run()).toBe(await run());
  });
});
