import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadLocal } from "./local.ts";

let repo: string;
const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: repo, encoding: "utf8" });
const write = (path: string, content: string) => {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), content);
};

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "ripple-local-"));
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "test");
  git("config", "commit.gpgsign", "false");
  write("src/a.ts", "export const a = 1;\n");
  write("src/old.ts", "export const old = 1;\nexport const keep = 2;\n");
  write("gone.txt", "bye\n");
  git("add", ".");
  git("commit", "-q", "-m", "base");
  git("switch", "-q", "-c", "feature");
  write("src/a.ts", "export const a = 2;\n");
  git("mv", "src/old.ts", "src/new.ts");
  git("rm", "-q", "gone.txt");
  write("src/b.ts", 'import { a } from "./a";\n');
  git("add", ".");
  git("commit", "-q", "-m", "feature");
});
afterAll(() => rmSync(repo, { recursive: true, force: true }));

describe("loadLocal", () => {
  it("diffs the branch against its merge base and reads head without a checkout", async () => {
    git("switch", "-q", "main"); // the working tree must not matter
    const cs = loadLocal(repo, "main", "feature");
    expect(
      cs.files.map((f) => [f.status, f.oldPath ?? null, f.path]).sort(),
    ).toEqual([
      ["added", null, "src/b.ts"],
      ["modified", null, "src/a.ts"],
      ["removed", "gone.txt", "gone.txt"],
      ["renamed", "src/old.ts", "src/new.ts"],
    ]);
    expect([...(await cs.head.list())].sort()).toEqual([
      "src/a.ts",
      "src/b.ts",
      "src/new.ts",
    ]);
    expect(await cs.head.read("src/a.ts")).toBe("export const a = 2;\n");
    expect(await cs.head.read("gone.txt")).toBeUndefined();
    expect(cs.patch).toContain("diff --git a/src/a.ts b/src/a.ts");
  });

  it("serves files read together the same as single reads", async () => {
    const cs = loadLocal(repo, "main", "feature");
    const [a, renamed, missing] = await Promise.all([
      cs.head.read("src/a.ts"),
      cs.head.read("src/new.ts"),
      cs.head.read("missing.ts"),
    ]);
    expect(a).toBe("export const a = 2;\n");
    expect(renamed).toBe("export const old = 1;\nexport const keep = 2;\n");
    expect(missing).toBeUndefined();
    expect(await cs.head.read("src/new.ts")).toBe(renamed);
  });
});
