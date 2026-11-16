import { describe, expect, it } from "vitest";
import { ago, count, messageOf, size } from "./format.ts";

describe("format", () => {
  const now = new Date("2026-11-16T12:00:00Z");
  it("says roughly when", () => {
    expect(ago("2026-11-16T11:59:40Z", now)).toBe("just now");
    expect(ago("2026-11-16T11:15:00Z", now)).toBe("45 min ago");
    expect(ago("2026-11-16T09:00:00Z", now)).toBe("3 hours ago");
    expect(ago("2026-11-15T10:00:00Z", now)).toBe("yesterday");
    expect(ago("2026-11-12T12:00:00Z", now)).toBe("4 days ago");
    expect(ago("2026-10-01T12:00:00Z", now)).toMatch(/Oct/);
    expect(ago("not a date", now)).toBe("");
  });

  it("gives sizes and counts", () => {
    expect(size(12)).toBe("< 1 KB");
    expect(size(12_345)).toBe("12 KB");
    expect(size(3_456_789)).toBe("3.5 MB");
    expect(count(1, "file")).toBe("1 file");
    expect(count(2, "answer")).toBe("2 answers");
  });

  it("says what went wrong", () => {
    expect(messageOf(new Error("gone"))).toBe("gone");
    expect(messageOf("plain")).toBe("plain");
  });
});
