import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SAVED_REVIEWS } from "./saved-reviews";

const FIXTURES = join(import.meta.dirname, "../../../cli/fixtures");

describe("SAVED_REVIEWS", () => {
  it("is bumped when the recorded orders change", () => {
    const hash = createHash("sha256");
    for (const name of readdirSync(FIXTURES).sort()) {
      if (statSync(join(FIXTURES, name)).isDirectory()) {
        hash.update(readFileSync(join(FIXTURES, name, "expected.md")));
      }
    }
    // Failing? The engine orders differently now: bump SAVED_REVIEWS.version
    // in saved-reviews.ts and set `goldens` to the hash below.
    expect(SAVED_REVIEWS.goldens).toBe(hash.digest("hex").slice(0, 16));
  });
});
