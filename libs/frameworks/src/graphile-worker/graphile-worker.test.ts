import { adapterContext, MemorySnapshot } from "@ripple-review/core/snapshot";
import { describe, expect, it } from "vitest";
import { GraphileWorker } from "./graphile-worker.ts";

const task = [
  'import type { Task } from "graphile-worker";',
  "const sendEmail: Task = async (payload, helpers) => {};",
  "export default sendEmail;",
].join("\n");

const files: Record<string, string> = {
  "package.json": JSON.stringify({ name: "shop" }),
  "apps/worker/package.json": JSON.stringify({
    dependencies: { "graphile-worker": "0.16.6" },
  }),
  "apps/worker/src/tasks/email/send-email.ts": task,
  "apps/web/src/tasks/task-list.ts": task,
};

async function rule(paths: Record<string, string> = files) {
  const r = new GraphileWorker();
  const found = await r.detect(await adapterContext(new MemorySnapshot(paths)));
  return { r, found };
}

describe("graphile-worker", () => {
  it("is detected by graphile-worker in a package.json", async () => {
    expect((await rule()).found).toBe(true);
    const { "apps/worker/package.json": _, ...without } = files;
    expect((await rule(without)).found).toBe(false);
  });

  it("names a task file under tasks/ by its basename, at any depth", async () => {
    const { r } = await rule();
    expect(
      r.file({
        path: "apps/worker/src/tasks/email/send-email.ts",
        content: task,
      })?.definitions,
    ).toEqual(["send-email"]);
    expect(
      r.file({ path: "apps/worker/tasks/process_event.js", content: task })
        ?.definitions,
    ).toEqual(["process_event"]);
  });

  it("leaves other files alone", async () => {
    const { r } = await rule();
    const none = (path: string, content = task) =>
      expect(r.file({ path, content })).toBeUndefined();
    none("apps/web/src/tasks/task-list.ts"); // a package without graphile-worker
    none("apps/worker/src/tasks/index.ts");
    none("apps/worker/src/tasks/send-email.test.ts");
    none("apps/worker/src/tasks/tasks.db-interaction.ts");
    none("apps/worker/src/tasks/README.md");
    none("apps/worker/src/tasks/shared.ts", "export const x = 1;"); // no default export
    none("apps/worker/src/jobs/send-email.ts");
  });

  it("takes every tasks/ folder when the root package depends on it", async () => {
    const { r } = await rule({
      "package.json": JSON.stringify({
        devDependencies: { "graphile-worker": "0.16.6" },
      }),
    });
    expect(
      r.file({ path: "apps/worker/src/tasks/send-email.ts", content: task })
        ?.definitions,
    ).toEqual(["send-email"]);
  });
});
