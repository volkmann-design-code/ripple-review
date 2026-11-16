#!/usr/bin/env bun
/**
 * Drift check: the `$schema` in `biome.json` names the Biome version pinned in
 * the root `package.json`.
 *
 * Renovate bumps the pin but not the schema URL; Biome then reports a version
 * mismatch on every run and editors validate against the old rule set.
 * `biome migrate --write` updates it.
 */

const REPO_ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const SCHEMA = /^https:\/\/biomejs\.dev\/schemas\/([^/]+)\/schema\.json$/;

const { devDependencies } = (await Bun.file(
  `${REPO_ROOT}/package.json`,
).json()) as { devDependencies?: Record<string, string> };
const pinned = devDependencies?.["@biomejs/biome"];
const { $schema } = (await Bun.file(`${REPO_ROOT}/biome.json`).json()) as {
  $schema?: string;
};
const schemaVersion = $schema?.match(SCHEMA)?.[1];

if (!pinned || schemaVersion !== pinned) {
  console.error(
    `✗ biome.json $schema is ${JSON.stringify($schema)}, package.json pins @biomejs/biome ${JSON.stringify(pinned)}.`,
  );
  console.error("  Run `bunx @biomejs/biome migrate --write`.");
  process.exit(1);
}
console.log(`✓ biome.json $schema matches @biomejs/biome ${pinned}`);
