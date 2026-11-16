import { join } from "node:path";
import type { ChangeRef } from "@ripple-review/api-contract";
import {
  ForgeError,
  type ViewedChange,
  type ViewedState,
} from "@ripple-review/core/forge";
import { MemoryStore } from "@ripple-review/core/store";
import { loadFixture } from "@ripple-review/sources/fixture";
import { describe, expect, it } from "vitest";
import { ProgressStore } from "./progress";
import { Reviews } from "./reviews";
import type { ViewedPort } from "./viewed";

const FIXTURE = join(import.meta.dirname, "../../../cli/fixtures/hono-5556");
const REF: ChangeRef = { kind: "github", owner: "o", repo: "r", number: 3 };
const A = "src/router/reg-exp-router/router.ts";
const B = "src/router/trie-router/node.ts";

/** A forge keeping the user's marks, which can be told to refuse or fail. */
function fakeForge(marks = new Map<string, ViewedState>()) {
  const sent: ViewedChange[][] = [];
  const forge = {
    marks,
    sent,
    refuse: false,
    down: false,
    port: {
      forge: "GitHub",
      get: async () => {
        if (forge.down) {
          throw new ForgeError(502, "GitHub answered 502");
        }
        return new Map(forge.marks);
      },
      set: async (changes: ViewedChange[]) => {
        sent.push(changes);
        if (forge.refuse) {
          throw new ForgeError(
            403,
            "GitHub didn't let the token set the Viewed marks",
            'Fine-grained tokens need write access to "Pull requests"',
          );
        }
        for (const c of changes) {
          forge.marks.set(c.path, c.viewed ? "viewed" : "unviewed");
        }
      },
    } satisfies ViewedPort,
  };
  return forge;
}

function reviews(
  forge: ReturnType<typeof fakeForge>,
  store = new MemoryStore(),
) {
  const cs = loadFixture(FIXTURE);
  return new Reviews({
    loadChange: async () => cs,
    progress: new ProgressStore(store),
    model: () => undefined,
    viewed: () => forge.port,
  });
}

const paths = (ticks: { path: string }[]) => ticks.map((t) => t.path).sort();

describe("ticks synced with the forge's Viewed marks", () => {
  it("shows the forge's marks as ticks; dismissed ones (changed since) are not ticked", async () => {
    const forge = fakeForge(
      new Map([
        [A, "viewed"],
        [B, "dismissed"],
        ["not/in/the/change.ts", "viewed"],
      ]),
    );
    const r = await reviews(forge).review(REF, undefined, () => {});
    expect(paths(r.ticks)).toEqual([A]);
    expect(r.ticks[0]?.patchHash).toBe(r.files[A]?.patchHash);
    expect(r.viewedSync).toEqual({ forge: "GitHub", synced: true });
  });

  it("marks and unmarks on the forge what the reviewer ticks and unticks", async () => {
    const forge = fakeForge(new Map([[B, "viewed"]]));
    const rv = reviews(forge);
    const r = await rv.review(REF, undefined, () => {});
    const tick = (path: string) => ({
      path,
      patchHash: r.files[path]?.patchHash ?? "",
    });
    const saved = await rv.saveTicks(REF, [tick(A)]);
    expect(saved.viewedSync?.synced).toBe(true);
    expect(forge.sent.at(-1)).toEqual([
      { path: A, viewed: true },
      { path: B, viewed: false },
    ]);
    expect(forge.marks.get(A)).toBe("viewed");
    expect(forge.marks.get(B)).toBe("unviewed");
    expect(paths((await rv.review(REF, undefined, () => {})).ticks)).toEqual([
      A,
    ]);
  });

  it("follows marks set on the forge itself", async () => {
    const forge = fakeForge();
    const rv = reviews(forge);
    expect((await rv.review(REF, undefined, () => {})).ticks).toEqual([]);
    forge.marks.set(B, "viewed");
    expect(paths((await rv.review(REF, undefined, () => {})).ticks)).toEqual([
      B,
    ]);
  });

  it("keeps ticks the forge refused, says why, and sends them once it accepts", async () => {
    const forge = fakeForge();
    const store = new MemoryStore();
    const rv = reviews(forge, store);
    const r = await rv.review(REF, undefined, () => {});
    forge.refuse = true;
    const saved = await rv.saveTicks(REF, [
      { path: A, patchHash: r.files[A]?.patchHash ?? "" },
    ]);
    expect(saved.viewedSync).toMatchObject({
      synced: false,
      status: 403,
      hint: expect.stringMatching(/Pull requests/),
    });
    expect(saved.pending).toEqual([
      { path: A, patchHash: r.files[A]?.patchHash, viewed: true },
    ]);
    // Still ticked after a reload, though the forge doesn't have it.
    const reloaded = await reviews(forge, store).review(
      REF,
      undefined,
      () => {},
    );
    expect(paths(reloaded.ticks)).toEqual([A]);
    expect(reloaded.viewedSync?.synced).toBe(false);

    // A token that may: the next load sends it.
    forge.refuse = false;
    const synced = await reviews(forge, store).review(REF, undefined, () => {});
    expect(synced.viewedSync?.synced).toBe(true);
    expect(forge.marks.get(A)).toBe("viewed");
    expect(await store.get("github:o/r#3")).not.toHaveProperty("pending");
  });

  it("shows the ticks kept here when the forge can't be read", async () => {
    const forge = fakeForge();
    const rv = reviews(forge);
    const r = await rv.review(REF, undefined, () => {});
    await rv.saveTicks(REF, [
      { path: A, patchHash: r.files[A]?.patchHash ?? "" },
    ]);
    forge.down = true;
    const again = await rv.review(REF, undefined, () => {});
    expect(paths(again.ticks)).toEqual([A]);
    expect(again.viewedSync).toMatchObject({
      synced: false,
      error: expect.stringMatching(
        /^Couldn't read your Viewed marks on GitHub/,
      ),
    });
  });

  it("sends ticks in the order they were made", async () => {
    const forge = fakeForge();
    const rv = reviews(forge);
    const r = await rv.review(REF, undefined, () => {});
    const a = { path: A, patchHash: r.files[A]?.patchHash ?? "" };
    // Tick and untick at once: the untick must land last.
    await Promise.all([rv.saveTicks(REF, [a]), rv.saveTicks(REF, [])]);
    expect(forge.sent).toEqual([
      [{ path: A, viewed: true }],
      [{ path: A, viewed: false }],
    ]);
    expect(forge.marks.get(A)).toBe("unviewed");
  });
});
