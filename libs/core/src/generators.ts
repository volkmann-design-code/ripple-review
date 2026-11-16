import type { Snapshot } from "./model.ts";
import { dirOf, joinRepo } from "./paths.ts";

/*
 * Files that widely used code generators write, read from their config files:
 * a generated file can be small and have no header, but its generator's
 * config names it. Paths in a config are relative to the config's directory.
 * Parsing is by pattern, not by a YAML/TS parser: the configs name their
 * outputs in a few well-known keys.
 */

interface Generator {
  /** Config file names (basename). */
  config: RegExp;
  outputs(content: string): string[];
}

/** Quoted or bare (YAML) values of the given keys: `out: gen`, `output = "x"`, `"outFile": "y"`. */
function valuesOf(content: string, keys: string[]): string[] {
  const k = keys.join("|");
  const quoted = new RegExp(
    `(?:^|[\\s{,])["']?(?:${k})["']?\\s*[:=]\\s*(["'\`])([^"'\`\\n]+)\\1`,
    "gm",
  );
  const bare = new RegExp(
    `^\\s*-?\\s*(?:${k}):\\s*([^\\s#"'\`{[][^\\s#]*)`,
    "gm",
  );
  return [
    ...[...content.matchAll(quoted)].map((m) => m[2] ?? ""),
    ...[...content.matchAll(bare)].map((m) => m[1] ?? ""),
  ];
}

/** The bodies of `key: { … }` objects (balanced braces). */
function blocksOf(content: string, key: string): string[] {
  const out: string[] = [];
  for (const m of content.matchAll(
    new RegExp(`["']?${key}["']?\\s*:\\s*\\{`, "g"),
  )) {
    let depth = 0;
    const from = m.index + m[0].length - 1;
    for (let i = from; i < content.length; i++) {
      if (content[i] === "{") {
        depth++;
      } else if (content[i] === "}" && --depth === 0) {
        out.push(content.slice(from + 1, i));
        break;
      }
    }
  }
  return out;
}

/** graphql-codegen: the keys of `generates`, in YAML or in a TS/JS/JSON object. */
function codegenOutputs(content: string): string[] {
  const out: string[] = [];
  const lines = content.split("\n");
  const at = lines.findIndex((l) => /^\s*generates:\s*(#.*)?$/.test(l));
  if (at >= 0) {
    const base = /^\s*/.exec(lines[at] ?? "")?.[0].length ?? 0;
    let child: number | undefined;
    for (const l of lines.slice(at + 1)) {
      if (l.trim() === "" || l.trim().startsWith("#")) {
        continue;
      }
      const indent = /^\s*/.exec(l)?.[0].length ?? 0;
      if (indent <= base) {
        break;
      }
      child ??= indent;
      const key = /^\s*(["']?)(.+?)\1:\s*(#.*)?$/.exec(l);
      if (indent === child && key?.[2]) {
        out.push(key[2]);
      }
    }
    return out;
  }
  const start = /["']?generates["']?\s*:\s*\{/.exec(content);
  if (!start) {
    return out;
  }
  let depth = 0;
  for (let i = start.index + start[0].length - 1; i < content.length; i++) {
    const c = content[i];
    if (c === "{") {
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) {
        break;
      }
    } else if (depth === 1 && (c === '"' || c === "'" || c === "`")) {
      const m = /^(["'`])([^"'`\n]+)\1\s*:/.exec(content.slice(i));
      if (m?.[2]) {
        out.push(m[2]);
      }
      const end = content.indexOf(c, i + 1);
      i = end < 0 ? content.length : end;
    }
  }
  return out;
}

const GENERATORS: Generator[] = [
  {
    // graphql-codegen
    config:
      /^(codegen\.(ya?ml|json|[cm]?[jt]s)|\.graphqlrc(\.(ya?ml|json|[cm]?[jt]s))?)$/,
    outputs: codegenOutputs,
  },
  // Prisma: `generator client { output = "../src/generated" }`
  { config: /\.prisma$/, outputs: (c) => valuesOf(c, ["output"]) },
  // buf: `plugins: [{ out: gen/go }]`
  { config: /^buf\.gen\.ya?ml$/, outputs: (c) => valuesOf(c, ["out"]) },
  // sqlc: `gen: { go: { out: internal/db } }`
  { config: /^sqlc\.(ya?ml|json)$/, outputs: (c) => valuesOf(c, ["out"]) },
  // Orval: `output: { target: "src/api.ts", schemas: "src/model" }`
  {
    config: /^orval\.config\.[cm]?[jt]s$/,
    outputs: (c) => [
      // `output: "src/api.ts"` or `output: { target, schemas }`; `input` has a `target` too
      ...valuesOf(c, ["output"]),
      ...blocksOf(c, "output").flatMap((b) =>
        valuesOf(b, ["target", "schemas"]),
      ),
    ],
  },
  // openapi-generator-cli
  { config: /^openapitools\.json$/, outputs: (c) => valuesOf(c, ["output"]) },
  // kysely-codegen
  {
    config: /^\.kysely-codegenrc(\.(json|ya?ml|[cm]?[jt]s))?$/,
    outputs: (c) => valuesOf(c, ["outFile"]),
  },
  // PostGraphile v4 rc and v5 preset
  {
    config: /^(\.postgraphilerc\.[cm]?[jt]s|graphile\.config\.[cm]?[jt]s)$/,
    outputs: (c) =>
      valuesOf(c, [
        "exportGqlSchemaPath",
        "exportJsonSchemaPath",
        "exportSchemaSDLPath",
        "exportSchemaIntrospectionResultPath",
      ]),
  },
];

const HAS_EXTENSION = /\.[A-Za-z0-9]+$/;

interface Output {
  path: string;
  dir: boolean;
}

/** Where a config's output lands; undefined for what we can't place safely. */
function place(configPath: string, value: string): Output | undefined {
  const v = value.trim();
  if (v === "" || /[*?{}$<>|]/.test(v) || /^[a-z]+:/i.test(v)) {
    return undefined; // globs, interpolation, URLs, env lookups
  }
  const configDir = dirOf(configPath);
  const path = joinRepo(configDir, v.replace(/\/+$/, ""));
  if (path === undefined || path === "" || path === ".") {
    return undefined;
  }
  const dir = v.endsWith("/") || !HAS_EXTENSION.test(path);
  // `out: .` or `out: ..` would make the config's whole tree generated.
  if (dir && (configDir === path || configDir.startsWith(`${path}/`))) {
    return undefined;
  }
  return { path, dir };
}

/** The outputs of every known generator config in the repository at head. */
export async function generatorOutputs(head: Snapshot): Promise<Output[]> {
  const configs = (await head.list()).flatMap((p) => {
    const base = p.slice(p.lastIndexOf("/") + 1);
    const gen = GENERATORS.find((g) => g.config.test(base));
    return gen && !p.split("/").includes("node_modules") ? [{ p, gen }] : [];
  });
  const contents = await Promise.all(configs.map(({ p }) => head.read(p)));
  const outputs: Output[] = [];
  for (const [i, { p, gen }] of configs.entries()) {
    const content = contents[i];
    if (content === undefined) {
      continue;
    }
    for (const v of gen.outputs(content)) {
      const o = place(p, v);
      if (o) {
        outputs.push(o);
      }
    }
  }
  return outputs;
}

/** Matcher for files a known generator writes. */
export async function generatorMatcher(
  head: Snapshot,
): Promise<(path: string) => boolean> {
  const outputs = await generatorOutputs(head);
  const files = new Set(outputs.filter((o) => !o.dir).map((o) => o.path));
  const dirs = outputs.filter((o) => o.dir).map((o) => `${o.path}/`);
  return (path) => files.has(path) || dirs.some((d) => path.startsWith(d));
}
