import type { ChangeRef, ReviewThread } from "@ripple-review/api-contract";
import { ForgeError } from "@ripple-review/core/forge";
import { MemoryStore } from "@ripple-review/core/store";
import { describe, expect, it } from "vitest";
import { Drafts, type ReviewPort } from "./drafts";

const REF: ChangeRef = { kind: "github", owner: "o", repo: "r", number: 3 };
const LINE = { path: "a.ts", line: 2, side: "new" as const };

/** A forge with a pending review, which can be told to refuse or fail. */
function fakeForge(threads: ReviewThread[] = []) {
  let next = 0;
  const forge = {
    threads,
    submitted: [] as { event: string; body: string }[],
    refuse: false,
    ownChange: false,
    calls: 0,
  };
  const check = () => {
    forge.calls++;
    if (forge.refuse) {
      throw new ForgeError(
        403,
        "GitHub didn't let the token add the comment",
        'Fine-grained tokens need write access to "Pull requests"',
      );
    }
  };
  const comments = () => forge.threads.flatMap((t) => t.comments);
  const port: ReviewPort = {
    forge: "GitHub",
    features: {
      ranges: true,
      fileComments: true,
      events: ["comment", "approve", "request-changes"],
    },
    threads: async () => ({
      threads: structuredClone(forge.threads),
      ownChange: forge.ownChange,
    }),
    addDraft: async (anchor, body) => {
      check();
      if (anchor.line === 99) {
        throw new ForgeError(422, "GitHub didn't take the comment");
      }
      const t: ReviewThread = {
        id: `T${++next}`,
        anchor,
        outdated: false,
        resolved: false,
        comments: [
          {
            id: `C${next}`,
            author: "me",
            body,
            createdAt: "",
            pending: true,
          },
        ],
      };
      forge.threads.push(t);
      return structuredClone(t);
    },
    editDraft: async (id, body) => {
      check();
      const c = comments().find((c) => c.id === id);
      if (c) {
        c.body = body;
      }
    },
    deleteDraft: async (id) => {
      check();
      forge.threads = forge.threads.filter((t) => t.comments[0]?.id !== id);
    },
    submit: async (event, body) => {
      check();
      for (const c of comments()) {
        c.pending = false;
      }
      forge.submitted.push({ event, body });
    },
  };
  return { forge, port };
}

const drafts = (port: ReviewPort, store = new MemoryStore()) =>
  new Drafts({ port: () => port, store });

const thread = (id: string, pending: boolean): ReviewThread => ({
  id,
  anchor: LINE,
  outdated: false,
  resolved: false,
  comments: [{ id: `c-${id}`, author: "x", body: id, createdAt: "", pending }],
});

describe("draft comments in the forge's pending review", () => {
  it("shows the threads, and the reviewer's pending comments as drafts", async () => {
    const { forge, port } = fakeForge([
      thread("theirs", false),
      thread("mine", true),
    ]);
    forge.ownChange = true;
    const d = await drafts(port).get(REF);
    expect(d?.threads.map((t) => t.id)).toEqual(["theirs"]);
    expect(d?.drafts).toEqual([{ id: "c-mine", anchor: LINE, body: "mine" }]);
    // Authors can't approve their own change.
    expect(d?.events).toEqual(["comment"]);
    expect(d?.sync).toEqual({ forge: "GitHub", synced: true });
  });

  it("has nothing for a change on a forge without reviews", async () => {
    const d = new Drafts({ port: () => undefined, store: new MemoryStore() });
    expect(await d.get(REF)).toBeUndefined();
  });

  it("adds, edits and deletes drafts on the forge", async () => {
    const { forge, port } = fakeForge();
    const d = drafts(port);
    let r = await d.addDraft(REF, LINE, "first");
    const id = r.drafts[0]?.id ?? "";
    expect(r.drafts).toEqual([{ id, anchor: LINE, body: "first" }]);
    r = await d.editDraft(REF, id, "changed");
    expect(r.drafts[0]?.body).toBe("changed");
    expect(forge.threads[0]?.comments[0]?.body).toBe("changed");
    r = await d.deleteDraft(REF, id);
    expect(r.drafts).toEqual([]);
    expect(forge.threads).toEqual([]);
  });

  it("keeps drafts the forge refused, says why, and sends them on the next load", async () => {
    const { forge, port } = fakeForge();
    const store = new MemoryStore();
    forge.refuse = true;
    const r = await drafts(port, store).addDraft(REF, LINE, "kept");
    expect(r.drafts).toMatchObject([{ body: "kept", local: true }]);
    expect(r.sync).toMatchObject({
      synced: false,
      status: 403,
      hint: expect.stringMatching(/Pull requests/),
    });
    // Still there after a reload, though the forge doesn't have it.
    const reloaded = await drafts(port, store).get(REF);
    expect(reloaded?.drafts).toMatchObject([{ body: "kept", local: true }]);

    forge.refuse = false;
    const synced = await drafts(port, store).get(REF);
    expect(synced?.sync.synced).toBe(true);
    expect(synced?.drafts).toEqual([{ id: "C1", anchor: LINE, body: "kept" }]);
    expect(await store.get("github:o/r#3")).toEqual({});
  });

  it("changes a draft that is only in the browser there", async () => {
    const { forge, port } = fakeForge();
    forge.refuse = true;
    const d = drafts(port);
    const r = await d.addDraft(REF, LINE, "kept");
    const id = r.drafts[0]?.id ?? "";
    const calls = forge.calls;
    expect((await d.editDraft(REF, id, "edited")).drafts[0]?.body).toBe(
      "edited",
    );
    expect((await d.deleteDraft(REF, id)).drafts).toEqual([]);
    expect(forge.calls).toBe(calls);
  });

  it("keeps nothing when the forge won't have the comment there", async () => {
    const { port } = fakeForge();
    const store = new MemoryStore();
    await expect(
      drafts(port, store).addDraft(REF, { ...LINE, line: 99 }, "x"),
    ).rejects.toMatchObject({ status: 422 });
    expect((await drafts(port, store).get(REF))?.drafts).toEqual([]);
  });

  it("submits the review with the summary kept in the browser", async () => {
    const { forge, port } = fakeForge();
    const store = new MemoryStore();
    const d = drafts(port, store);
    await d.addDraft(REF, LINE, "a note");
    await d.saveSummary(REF, "Looks good");
    expect((await drafts(port, store).get(REF))?.summary).toBe("Looks good");
    const r = await d.submit(REF, "approve", "Looks good");
    expect(forge.submitted).toEqual([{ event: "approve", body: "Looks good" }]);
    expect(r.summary).toBe("");
    expect(r.drafts).toEqual([]);
    expect(r.threads.map((t) => t.comments[0]?.body)).toEqual(["a note"]);
  });

  it("doesn't submit while drafts are still only in the browser", async () => {
    const { forge, port } = fakeForge();
    const d = drafts(port);
    forge.refuse = true;
    await d.addDraft(REF, LINE, "waiting");
    await expect(d.submit(REF, "comment", "")).rejects.toMatchObject({
      status: 403,
      message: expect.stringMatching(/aren't on GitHub yet/),
    });
    expect(forge.submitted).toEqual([]);
    forge.refuse = false;
    await d.submit(REF, "comment", "");
    expect(forge.submitted).toHaveLength(1);
    expect(forge.threads[0]?.comments[0]).toMatchObject({
      body: "waiting",
      pending: false,
    });
  });
});
