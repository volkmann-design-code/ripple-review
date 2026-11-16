import type {
  ChangeSet,
  Edge,
  FileNode,
  ReviewGroup,
  ReviewItem,
  Role,
} from "../model.ts";
import { MemorySnapshot } from "../snapshot.ts";

/** A small change for the AI layer's tests: two stories, a mechanical edit, standalone and generated files. */

export const item = (path: string, role: Role = "source"): ReviewItem => ({
  path,
  role,
  additions: 1,
  deletions: 0,
  status: "modified",
  notes: [],
});

export const groups = (): ReviewGroup[] => [
  {
    kind: "context",
    title: "Context: read first",
    items: [item("README.md", "docs")],
  },
  {
    kind: "story",
    title: "Around `a.ts`",
    items: [item("a.ts"), item("b.ts")],
  },
  {
    kind: "mechanical",
    title: "Rename",
    items: [item("m1.ts"), item("m2.ts")],
  },
  {
    kind: "story",
    title: "Around `c.ts`",
    items: [item("c.ts"), item("c.test.ts", "test")],
  },
  { kind: "misc", title: "Standalone changes", items: [item("s.ts")] },
  {
    kind: "generated",
    title: "Generated",
    items: [item("gen.ts", "generated")],
  },
];

export const edges: Edge[] = [
  { from: "a.ts", to: "b.ts", kind: "import", via: ["x"] },
  { from: "c.ts", to: "c.test.ts", kind: "import", via: ["c"] },
];

export const paths = (gs: ReviewGroup[]) =>
  gs.flatMap((g) => g.items.map((i) => i.path));

export const cs: ChangeSet = {
  title: "Checkout",
  head: new MemorySnapshot({}),
  files: [
    "README.md",
    "a.ts",
    "b.ts",
    "m1.ts",
    "m2.ts",
    "c.ts",
    "c.test.ts",
    "s.ts",
    "gen.ts",
  ].map((path) => ({
    path,
    status: "modified" as const,
    additions: 1,
    deletions: 0,
    binary: false,
    hunks: [
      {
        oldStart: 1,
        oldLines: 0,
        newStart: 1,
        newLines: 1,
        lines: [`+in ${path}`],
      },
    ],
  })),
};

export const nodes = new Map<string, FileNode>(
  cs.files.map((file) => [
    file.path,
    {
      file,
      role: "source",
      facts: {
        imports: [],
        exports: ["in", "untouched"],
        reexports: [],
        definitions: [],
      },
    },
  ]),
);
