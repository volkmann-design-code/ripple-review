import type {
  FrameworkFacts,
  FrameworkFile,
  FrameworkRule,
} from "@ripple-review/core/framework";
import type { AdapterContext } from "@ripple-review/core/model";
import { packagesUsing } from "../manifests.ts";

/** A script under a `tasks/` folder, not a test; group 1 is its basename. */
const TASK_FILE = /\/tasks\/(?:[^/]+\/)*([^/]+)\.[cm]?[jt]s$/;
/** What a task is queued by: `send-email`, `send_email`, `sendEmail`; no dots. */
const TASK_NAME = /^[A-Za-z][A-Za-z0-9]*(?:[-_][A-Za-z0-9]+)*$/;
/** graphile-worker loads a task file's default export. */
const DEFAULT_EXPORT = /\bexport\s+default\b|\bmodule\.exports\b/;

/**
 * graphile-worker: a task file under `tasks/` (at any depth, in a package
 * that depends on `graphile-worker`) is queued by its basename, from SQL
 * (`add_job('send-email', …)`, a project's own `enqueue_job` wrapper), from
 * code (`addJob("send-email")`), a crontab or a list of task names. The
 * basename is the task's name, so every mention of it links to the file.
 * Inferred from the layout (D2): task names given in code, by
 * `taskDirectory` or a project's own `defineTask("…")`, aren't read.
 */
export class GraphileWorker implements FrameworkRule {
  readonly id = "graphile-worker";
  readonly name = "graphile-worker";
  /** Folders of the packages using graphile-worker ("" for the root). */
  private roots: string[] = [];

  async detect(ctx: AdapterContext): Promise<boolean> {
    this.roots = await packagesUsing(ctx, "graphile-worker");
    return this.roots.length > 0;
  }

  file(f: FrameworkFile): FrameworkFacts | undefined {
    const name = TASK_FILE.exec(`/${f.path}`)?.[1];
    if (
      !name ||
      name === "index" ||
      !TASK_NAME.test(name) ||
      f.content === undefined ||
      !DEFAULT_EXPORT.test(f.content) ||
      !this.roots.some((r) => r === "" || f.path.startsWith(`${r}/`))
    ) {
      return undefined;
    }
    return { definitions: [name] };
  }
}
