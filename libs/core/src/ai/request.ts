import type { ChangeSet, Edge, FileNode, ReviewGroup } from "../model.ts";
import {
  changedLinesOf,
  filesWithDiff,
  MAX_FILE_LINES,
  MAX_TOTAL_LINES,
  MIN_FILE_LINES,
  trimmedDiff,
} from "./excerpts.ts";
import type { AiInput, AiRequest } from "./port.ts";
import { FULL, SCHEMA, SUMMARY } from "./prompt.ts";
import { readDiffTool } from "./read-diff.ts";

/** Summary: changed lines shown per file, and their width. */
const PREVIEW_LINES = 4;
const PREVIEW_WIDTH = 120;
const IDENT = /[A-Za-z_$][\w$]*/g;

/** Names the file defines or exports that its diff touches. */
function touchedNames(lines: string[], node: FileNode | undefined): string[] {
  const facts = node?.facts;
  if (!facts) {
    return [];
  }
  const mentioned = new Set(lines.flatMap((l) => l.match(IDENT) ?? []));
  return [...new Set([...facts.exports, ...facts.definitions])].filter((n) =>
    mentioned.has(n),
  );
}

function groupsSection(
  cs: ChangeSet,
  groups: ReviewGroup[],
  summary: { nodes?: Map<string, FileNode> } | undefined,
): string[] {
  const out: string[] = ["## Groups"];
  const withDiff = new Set(filesWithDiff(groups).map((i) => i.path));
  groups.forEach((g, id) => {
    out.push("", `### Group ${id} (${g.kind}): ${g.title}`);
    for (const it of g.items) {
      out.push(
        `- ${it.path} · ${it.role} · ${it.status} · +${it.additions} −${it.deletions}`,
      );
      if (!summary || !withDiff.has(it.path)) {
        continue;
      }
      const lines = changedLinesOf(cs, it.path);
      const names = touchedNames(lines, summary.nodes?.get(it.path));
      if (names.length) {
        out.push(
          `  touches: ${names.slice(0, 12).join(", ")}${names.length > 12 ? ` +${names.length - 12} more` : ""}`,
        );
      }
      const preview = lines
        .filter((l) => l.slice(1).trim() !== "")
        .slice(0, PREVIEW_LINES);
      for (const l of preview) {
        out.push(
          `  ${l.length > PREVIEW_WIDTH ? `${l.slice(0, PREVIEW_WIDTH)}…` : l}`,
        );
      }
    }
  });
  return out;
}

/** Links, one line per file listing what it is read after (compact). */
function linksSection(edges: Edge[]): string[] {
  const out = ["## Links (each file is read after the files listed for it)"];
  const into = new Map<string, Edge[]>();
  for (const e of edges) {
    into.set(e.to, [...(into.get(e.to) ?? []), e]);
  }
  for (const [to, es] of into) {
    const from = es.map(
      (e) =>
        `${e.from} (${e.kind}${e.via.length ? `: ${e.via.slice(0, 4).join(", ")}${e.via.length > 4 ? ", …" : ""}` : ""})`,
    );
    out.push(`- ${to} ← ${from.join("; ")}`);
  }
  return out;
}

export interface BuildOptions {
  input?: AiInput;
  /** The analysis' nodes: the summary lists the names each file's diff touches. */
  nodes?: Map<string, FileNode>;
}

/** The request for one change: its static order, links and the diff or a summary of it. */
export function buildRequest(
  cs: ChangeSet,
  groups: ReviewGroup[],
  edges: Edge[],
  options: BuildOptions = {},
): AiRequest & { reads: string[] } {
  const summary = options.input === "summary";
  const out: string[] = [`# Pull request: ${cs.title ?? "(no title)"}`, ""];
  out.push(
    ...groupsSection(
      cs,
      groups,
      summary ? { nodes: options.nodes } : undefined,
    ),
    "",
    ...linksSection(edges),
  );
  if (summary) {
    const tool = readDiffTool(cs, groups);
    return {
      system: SUMMARY,
      user: out.join("\n"),
      schema: { ...SCHEMA },
      tools: [tool],
      reads: tool.reads,
    };
  }
  const shown = filesWithDiff(groups);
  const perFile = Math.max(
    MIN_FILE_LINES,
    Math.min(MAX_FILE_LINES, Math.floor(MAX_TOTAL_LINES / (shown.length || 1))),
  );
  out.push("", "## Diff");
  for (const it of shown) {
    out.push(
      "",
      `### ${it.path}`,
      "```diff",
      trimmedDiff(cs, it.path, perFile),
      "```",
    );
  }
  return {
    system: FULL,
    user: out.join("\n"),
    schema: { ...SCHEMA },
    reads: [],
  };
}
