import { describe, expect, it } from "vitest";
import type { FrameworkRule } from "./framework.ts";
import { analyze } from "./graph.ts";
import type { ChangedFile, ChangeSet, LanguageAdapter } from "./model.ts";
import { dirOf, joinRepo } from "./paths.ts";
import { MemorySnapshot } from "./snapshot.ts";

/**
 * A toy language (`.toy`), one statement per line:
 *   use a, b from ./x   ·   pass * from ./x   ·   pass a as b from ./x   ·   def name
 */
const toy: LanguageAdapter = {
  id: "toy",
  supports: (p) => p.endsWith(".toy"),
  parse(_path, content) {
    const facts = {
      imports: [] as { specifier: string; names: string[] }[],
      exports: [] as string[],
      reexports: [] as {
        specifier: string;
        names: "*" | { from: string; as: string }[];
      }[],
      definitions: [] as string[],
    };
    for (const line of content.split("\n")) {
      const use = /^use (.+) from (\S+)$/.exec(line);
      const passAll = /^pass \* from (\S+)$/.exec(line);
      const passOne = /^pass (\w+) as (\w+) from (\S+)$/.exec(line);
      const def = /^def (\S+)$/.exec(line);
      if (use) {
        facts.imports.push({
          specifier: use[2]!,
          names: use[1]!.split(/, */),
        });
      } else if (passAll) {
        facts.reexports.push({ specifier: passAll[1]!, names: "*" });
      } else if (passOne) {
        facts.reexports.push({
          specifier: passOne[3]!,
          names: [{ from: passOne[1]!, as: passOne[2]! }],
        });
      } else if (def) {
        facts.exports.push(def[1]!);
        facts.definitions.push(def[1]!);
      }
    }
    return facts;
  },
  resolve: (spec, from) => joinRepo(dirOf(from), `${spec}.toy`),
};

/** A change where every listed file is added with its whole content. */
function change(files: Record<string, string>, changed: string[]): ChangeSet {
  const added = (path: string): ChangedFile => {
    const lines = (files[path] ?? "").split("\n").map((l) => `+${l}`);
    return {
      path,
      status: "added",
      additions: lines.length,
      deletions: 0,
      binary: false,
      hunks: [
        {
          oldStart: 0,
          oldLines: 0,
          newStart: 1,
          newLines: lines.length,
          lines,
        },
      ],
    };
  };
  return { head: new MemorySnapshot(files), files: changed.map(added) };
}

const edges = async (cs: ChangeSet) =>
  (await analyze(cs, [toy])).edges
    .map((e) => `${e.kind} ${e.from} → ${e.to} [${e.via.join(",")}]`)
    .sort();

describe("analyze", () => {
  it("follows imports through unchanged barrels to the defining file", async () => {
    const files = {
      "lib/impl.toy": "def makeThing",
      "lib/index.toy": "pass * from ./inner",
      "lib/inner.toy": "pass makeThing as makeThing from ./impl",
      "app/main.toy": "use makeThing from ../lib/index",
    };
    expect(
      await edges(change(files, ["lib/impl.toy", "app/main.toy"])),
    ).toEqual(["import lib/impl.toy → app/main.toy [makeThing]"]);
  });

  it("survives re-export cycles", async () => {
    const files = {
      "a.toy": "pass * from ./b",
      "b.toy": "pass * from ./a",
      "c.toy": "use missing from ./a",
    };
    await expect(
      analyze(change(files, ["c.toy", "a.toy"]), [toy]),
    ).resolves.toBeDefined();
  });

  it("links files by distinctive names, in any language", async () => {
    const files = {
      "db/fn.toy": "def get_user_by_email",
      "app/call.ts": "const u = await db.get_user_by_email(email);",
      "app/short.ts": "use(get);",
    };
    expect(
      await edges(change(files, ["db/fn.toy", "app/call.ts", "app/short.ts"])),
    ).toEqual(["name db/fn.toy → app/call.ts [get_user_by_email]"]);
  });

  it("links a name spelled another way, if it has three words or more", async () => {
    const files = {
      "db/fn.toy": "def set_line_items_tax_rate\ndef user_id",
      "app/mutation.gql": "mutation { setLineItemsTaxRate(input: $i) { id } }",
      "app/user.ts": "const u = row.userId;",
    };
    expect(
      await edges(
        change(files, ["db/fn.toy", "app/mutation.gql", "app/user.ts"]),
      ),
    ).toEqual(["name db/fn.toy → app/mutation.gql [set_line_items_tax_rate]"]);
  });

  it("links a name mentioned as a string literal", async () => {
    const files = {
      "auth/perms.toy": "def referrals:write",
      "db/policy.sql": "using (has_permission('referrals:write'));",
    };
    expect(
      await edges(change(files, ["auth/perms.toy", "db/policy.sql"])),
    ).toEqual(["name auth/perms.toy → db/policy.sql [referrals:write]"]);
  });

  it("links a kebab-case name such as a custom element", async () => {
    const files = {
      "ui/actions.toy": "def app-line-items-actions",
      "ui/list.html": '<app-line-items-actions (clicked)="open()" />',
    };
    expect(
      await edges(change(files, ["ui/actions.toy", "ui/list.html"])),
    ).toEqual(["name ui/actions.toy → ui/list.html [app-line-items-actions]"]);
  });

  it("does not take names from generated files", async () => {
    const files = {
      ".gitattributes": "schema.dump.toy linguist-generated",
      "schema.dump.toy": "def get_user_by_email",
      "app/call.ts": "db.get_user_by_email(email);",
    };
    expect(
      await edges(change(files, ["schema.dump.toy", "app/call.ts"])),
    ).toEqual([]);
  });

  describe("with framework rules", () => {
    /** A toy framework: `pages/x.yml` comes before `models/x.php`, which includes `parts/x.css`; tasks define their basename. */
    const toyFramework = (present: boolean): FrameworkRule => ({
      id: "toy-fw",
      name: "Toy",
      detect: () => Promise.resolve(present),
      file: ({ path }) => {
        const model = /^models\/(.+)\.php$/.exec(path);
        if (model) {
          return {
            dependsOn: [{ path: `pages/${model[1]}.yml`, via: "model of" }],
            parts: [`parts/${model[1]}.css`],
          };
        }
        const task = /^tasks\/(.+)\.ts$/.exec(path);
        return task ? { definitions: [task[1]!] } : undefined;
      },
      roleHint: (path) => (path.endsWith(".yml") ? "schema" : undefined),
    });
    const files = {
      "pages/project.yml": "title: Project",
      "models/project.php": "<?php class ProjectPage {}",
      "parts/project.css": ".project {}",
      "tasks/send-mail.ts": "export default () => {};",
      "db/queue.sql": "select add_job('send-mail');",
    };
    const cs = () => change(files, Object.keys(files));

    it("adds its parts, files read first and names, marked with its name", async () => {
      const { edges, nodes } = await analyze(cs(), [], [toyFramework(true)]);
      expect(
        edges
          .map(
            (e) =>
              `${e.kind} ${e.from} → ${e.to} [${e.via.join(",")}] ${e.framework}`,
          )
          .sort(),
      ).toEqual([
        "contains models/project.php → parts/project.css [project.css] Toy",
        "framework pages/project.yml → models/project.php [model of] Toy",
        "name tasks/send-mail.ts → db/queue.sql [send-mail] Toy",
      ]);
      expect(nodes.get("pages/project.yml")?.role).toBe("schema");
    });

    it("adds nothing when its framework isn't detected", async () => {
      const { edges, nodes } = await analyze(cs(), [], [toyFramework(false)]);
      expect(edges).toEqual([]);
      expect(nodes.get("pages/project.yml")?.role).toBe("source");
    });
  });

  it("assigns a role and adapter to every changed file", async () => {
    const files = { "a.toy": "def x", "README.md": "hello" };
    const { nodes } = await analyze(change(files, ["a.toy", "README.md"]), [
      toy,
    ]);
    expect([...nodes].map(([p, n]) => [p, n.role, n.adapter])).toEqual([
      ["a.toy", "source", "toy"],
      ["README.md", "docs", undefined],
    ]);
  });
});
