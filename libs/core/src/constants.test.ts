import { describe, expect, it } from "vitest";
import { constantEnv, foldConstants } from "./constants.ts";

const env = new Map([
  ["DAY_MS", 86_400_000],
  ["HOUR_MS", 3_600_000],
]);
const fold = (l: string) => foldConstants(l, env).text;

describe("foldConstants", () => {
  it("folds products of numbers and known constants to one value", () => {
    expect(fold("export const X = 14 * 24 * 3_600_000;")).toBe(
      fold("export const X = 14 * DAY_MS;"),
    );
    expect(fold("const MAX = 30 * 24 * 60 * 60 * 1000; // 30 days")).toBe(
      "const MAX = 2592000000; // 30 days",
    );
    expect(fold("new Date(today - daysBack * 86_400_000)")).toBe(
      fold("new Date(today - daysBack * DAY_MS)"),
    );
  });

  it("names the constants it substituted", () => {
    expect(foldConstants("a + 3 * DAY_MS", env).names).toEqual(["DAY_MS"]);
  });

  it("leaves products that division, powers or member access bind into", () => {
    expect(fold("x / 2 * 3")).toBe("x / 2 * 3");
    expect(fold("2 * 3 ** 2")).toBe("2 * 3 ** 2");
    expect(fold("Units.DAY_MS * 2")).toBe("Units.DAY_MS * 2");
    expect(fold("unknownName * 2")).toBe("unknownName * 2");
  });
});

describe("constantEnv", () => {
  it("reads definitions that build on each other", () => {
    const e = constantEnv([
      "const DAY_MS = 24 * HOUR_MS;",
      "const HOUR_MS = 60 * 60 * 1000;",
      "MAX_RETRIES: int = 5",
    ]);
    expect(Object.fromEntries(e)).toEqual({
      DAY_MS: 86_400_000,
      HOUR_MS: 3_600_000,
      MAX_RETRIES: 5,
    });
  });

  it("leaves out names defined with different values or non-constants", () => {
    const e = constantEnv([
      "const LIMIT = 10;",
      "const LIMIT = 20;",
      "const URL = makeUrl();",
      "const camel = 3;",
    ]);
    expect(e.size).toBe(0);
  });
});

describe("foldConstants with strings and sums", () => {
  const env = new Map<string, string | number>([
    ["API_BASE", "https://x.de"],
    ["HOUR_MS", 3_600_000],
  ]);
  const fold = (l: string) => foldConstants(l, env).text;

  it("concatenates strings and inlines templates", () => {
    const want = fold('fetch("https://x.de/v1");');
    expect(fold('fetch(API_BASE + "/v1");')).toBe(want);
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a template literal inside a diff line
    expect(fold("fetch(`${API_BASE}/v1`);")).toBe(want);
    expect(fold("fetch('https://x.de/v1');")).toBe(want);
  });

  it("adds only whole expressions", () => {
    expect(fold("const T = HOUR_MS + 30 * 60_000;")).toBe("const T = 5400000;");
    expect(fold("x * 2 + 3")).toBe("x * 2 + 3");
    expect(fold("a - 2 + 3")).toBe("a - 2 + 3");
    expect(fold("a - 2 * 3")).toBe("a - 6");
  });

  it("never multiplies a string", () => {
    expect(fold('= "ab" * 3;')).toBe('= "ab" * 3;');
  });
});

describe("constantEnv with strings", () => {
  it("reads string constants and concatenations", () => {
    const e = constantEnv([
      'const API_BASE = "https://x.de";',
      'const API_V1 = API_BASE + "/v1";',
    ]);
    expect(Object.fromEntries(e)).toEqual({
      API_BASE: "https://x.de",
      API_V1: "https://x.de/v1",
    });
  });
});
