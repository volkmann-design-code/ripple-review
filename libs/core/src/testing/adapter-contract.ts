import { describe, expect, it } from "vitest";
import type { LanguageAdapter } from "../model.ts";
import { normalizeRepoPath } from "../paths.ts";
import { adapterContext, MemorySnapshot } from "../snapshot.ts";

export interface AdapterContractCase {
  /** Repository files the adapter sees at head. */
  files: Record<string, string>;
  /** Files it must support (a subset of `files`). */
  supported: string[];
  /** Paths it must not claim. */
  unsupported: string[];
  /** Imports that must resolve: `from` file, specifier, expected repo path. */
  resolves: { from: string; specifier: string; to: string }[];
  /** Specifiers that must not resolve (external packages, missing files). */
  unresolved: { from: string; specifier: string }[];
}

/**
 * The suite every adapter runs: whatever the language, `parse` returns
 * well-formed facts and `resolve` returns an existing repository path or
 * undefined.
 */
export function adapterContract(
  makeAdapter: () => LanguageAdapter,
  c: AdapterContractCase,
): void {
  const setup = async () => {
    const adapter = makeAdapter();
    await adapter.init?.(await adapterContext(new MemorySnapshot(c.files)));
    return adapter;
  };

  describe(`adapter contract: ${makeAdapter().id}`, () => {
    it("supports its files and no others", async () => {
      const a = await setup();
      for (const p of c.supported) {
        expect(a.supports(p), p).toBe(true);
      }
      for (const p of c.unsupported) {
        expect(a.supports(p), p).toBe(false);
      }
    });

    it("parses every supported file into well-formed facts", async () => {
      const a = await setup();
      for (const p of c.supported) {
        const facts = a.parse(p, c.files[p] ?? "");
        const strings = (xs: unknown) =>
          Array.isArray(xs) && xs.every((x) => typeof x === "string");
        expect(strings(facts.exports), p).toBe(true);
        expect(strings(facts.definitions), p).toBe(true);
        for (const imp of facts.imports) {
          expect(typeof imp.specifier).toBe("string");
          expect(imp.names === "*" || strings(imp.names)).toBe(true);
        }
        for (const re of facts.reexports) {
          expect(typeof re.specifier).toBe("string");
        }
      }
    });

    it("parses an empty file", async () => {
      const a = await setup();
      const facts = a.parse(c.supported[0] ?? "", "");
      expect(facts.imports).toEqual([]);
      expect(facts.reexports).toEqual([]);
    });

    it("resolves imports to existing, normalized repository paths", async () => {
      const a = await setup();
      for (const r of c.resolves) {
        expect(a.resolve(r.specifier, r.from), r.specifier).toBe(r.to);
      }
      for (const [from, content] of Object.entries(c.files)) {
        if (!a.supports(from)) {
          continue;
        }
        for (const imp of a.parse(from, content).imports) {
          const to = a.resolve(imp.specifier, from);
          if (to !== undefined) {
            expect(c.files, `${from} → ${to}`).toHaveProperty([to]);
            expect(normalizeRepoPath(to)).toBe(to);
          }
        }
      }
    });

    it("returns undefined for what it can't resolve", async () => {
      const a = await setup();
      for (const r of c.unresolved) {
        expect(a.resolve(r.specifier, r.from), r.specifier).toBeUndefined();
      }
    });
  });
}
