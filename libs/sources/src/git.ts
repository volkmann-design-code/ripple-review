import { execFile, execFileSync, spawn } from "node:child_process";
import { batched } from "@ripple-review/core/batch";
import type { Snapshot } from "@ripple-review/core/model";

export function run(cmd: string, args: string[], cwd?: string): string {
  return execFileSync(cmd, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** `run` without blocking. */
export function runAsync(
  cmd: string,
  args: string[],
  cwd?: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      { cwd, encoding: "utf8", maxBuffer: 1024 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          // Same shape as execFileSync's error: the message carries stderr.
          reject(Object.assign(err, { stderr }));
        } else {
          resolve(stdout);
        }
      },
    );
  });
}

export function git(dir: string, args: string[]): string {
  return run("git", args, dir);
}

/** Runs a command with `input` on stdin; resolves to its raw stdout. */
function runWithInput(
  cmd: string,
  args: string[],
  cwd: string,
  input: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => chunks.push(c));
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (c: string) => {
      stderr += c;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(
          Object.assign(new Error(`${cmd} exited with ${code}`), { stderr }),
        );
      }
    });
    child.stdin.end(input);
  });
}

/** Lazily reads files of one revision straight from the object store, no checkout. */
export class GitSnapshot implements Snapshot {
  private files?: Promise<Set<string>>;
  /** Reads asked for together go to one `git cat-file --batch`. */
  private readonly readBatched = batched((paths) => this.load(paths));

  constructor(
    private readonly dir: string,
    private readonly rev: string,
  ) {}

  private fileSet(): Promise<Set<string>> {
    this.files ??= runAsync(
      "git",
      ["ls-tree", "-r", "--name-only", "-z", this.rev],
      this.dir,
    ).then((out) => new Set(out.split("\0").filter(Boolean)));
    return this.files;
  }

  async list(): Promise<readonly string[]> {
    return [...(await this.fileSet())];
  }

  async read(path: string): Promise<string | undefined> {
    return (await this.fileSet()).has(path)
      ? this.readBatched(path)
      : undefined;
  }

  private async load(paths: string[]): Promise<Map<string, string>> {
    const contents = new Map<string, string>();
    for (let i = 0; i < paths.length; i += 5000) {
      const chunk = paths.slice(i, i + 5000);
      const out = await runWithInput(
        "git",
        ["cat-file", "--batch"],
        this.dir,
        chunk.map((p) => `${this.rev}:${p}\n`).join(""),
      );
      let pos = 0;
      for (const path of chunk) {
        const nl = out.indexOf(10, pos);
        const header = out.subarray(pos, nl).toString("utf8").split(" ");
        pos = nl + 1;
        if (header[1] === "missing" || header.length < 3) {
          continue;
        }
        const size = Number(header[2]);
        if (header[1] === "blob") {
          contents.set(path, out.subarray(pos, pos + size).toString("utf8"));
        }
        pos += size + 1;
      }
    }
    return contents;
  }
}
