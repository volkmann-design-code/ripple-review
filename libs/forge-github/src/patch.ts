/** One entry of GitHub's "list pull request files" API. */
export interface PrFile {
  filename: string;
  previous_filename?: string;
  status: string;
  /** Missing for binary files and for diffs GitHub deems too large. */
  patch?: string;
}

/**
 * Rebuilds a unified diff from the files API, for PRs whose diff GitHub won't
 * serve (more than 300 files). Files without a patch get headers only.
 */
export function patchFromFiles(files: PrFile[]): string {
  const out: string[] = [];
  for (const f of files) {
    const old = f.previous_filename ?? f.filename;
    out.push(`diff --git a/${old} b/${f.filename}`);
    if (f.status === "added") {
      out.push("new file mode 100644", "--- /dev/null", `+++ b/${f.filename}`);
    } else if (f.status === "removed") {
      out.push("deleted file mode 100644", `--- a/${old}`, "+++ /dev/null");
    } else {
      if (f.status === "renamed") {
        out.push(`rename from ${old}`, `rename to ${f.filename}`);
      }
      out.push(`--- a/${old}`, `+++ b/${f.filename}`);
    }
    if (f.patch) {
      out.push(f.patch);
    }
  }
  return `${out.join("\n")}\n`;
}
