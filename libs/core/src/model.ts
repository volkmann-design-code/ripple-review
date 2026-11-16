// Language-agnostic data model shared by sources, adapters and the core.

export type FileStatus = "added" | "modified" | "removed" | "renamed";

export interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  /** Raw hunk body lines, each prefixed with "+", "-" or " ". */
  lines: string[];
}

export interface ChangedFile {
  path: string;
  oldPath?: string;
  status: FileStatus;
  additions: number;
  deletions: number;
  binary: boolean;
  hunks: Hunk[];
}

/**
 * Read-only view of the repository at one revision. Async, so it can sit on
 * a forge's API as well as on a local git repository.
 */
export interface Snapshot {
  /** Every path at this revision. */
  list(): Promise<readonly string[]>;
  /**
   * A file's text, or undefined if it doesn't exist or isn't text. Reads
   * asked for together may be served in one batch (see `batched`).
   */
  read(path: string): Promise<string | undefined>;
}

export interface ChangeSet {
  title?: string;
  url?: string;
  /** Builds a link to one file in the change's web view, if the source has one. */
  fileLink?: (path: string) => string;
  head: Snapshot;
  files: ChangedFile[];
  /** The unified diff `files` was parsed from, if the source has it as text. */
  patch?: string;
  /**
   * Identifies the compared revisions (e.g. "<base sha>..<head sha>"), if the
   * source knows them: a change with the same revision needn't be loaded again.
   */
  revision?: string;
}

// ── What a language adapter extracts from one file ────────────────────────

export interface ImportFact {
  specifier: string;
  /** Imported names, or "*" for namespace / side-effect / dynamic imports. */
  names: string[] | "*";
  typeOnly?: boolean;
  /**
   * "depends" (default): the importer uses the target, so the target is reviewed first.
   * "contains": the importer is composed of the target (e.g. SQL include), so the
   * importer is reviewed first and the target read as one of its parts.
   */
  relation?: "depends" | "contains";
}

export interface ReexportFact {
  specifier: string;
  names: { from: string; as: string }[] | "*";
}

export interface ModuleFacts {
  imports: ImportFact[];
  /** Names this file defines and exports itself. */
  exports: string[];
  /** Names this file passes through from other modules (barrels). */
  reexports: ReexportFact[];
  /**
   * Names this file defines that other files - in any language - may refer to by
   * name (SQL functions and columns, GraphQL types, exported TS symbols...).
   */
  definitions: string[];
}

export interface AdapterContext {
  head: Snapshot;
  /** Every path at head: imports resolve against it without reading. */
  paths: ReadonlySet<string>;
}

export interface LanguageAdapter {
  id: string;
  supports(path: string): boolean;
  /** Reads what resolution needs (configs, manifests) before any `resolve`. */
  init?(ctx: AdapterContext): Promise<void>;
  parse(path: string, content: string): ModuleFacts;
  /** Resolves an import specifier to a repository path at head, or undefined if external. */
  resolve(specifier: string, fromPath: string): string | undefined;
  /** Optional role hint for files this adapter knows (e.g. SQL migrations are "schema"). */
  roleHint?(path: string): Role | undefined;
}

// ── Core output ─────────────────────────────────────────────────────────────

export type Role =
  | "docs"
  | "schema"
  | "contract"
  | "source"
  | "wiring"
  | "config"
  | "test-support"
  | "test"
  | "generated"
  | "lockfile";

export type EdgeKind = "import" | "contains" | "name" | "via-generated";

/** `from` should be reviewed before `to`. */
export interface Edge {
  from: string;
  to: string;
  kind: EdgeKind;
  /** Symbols or names that carry the dependency. */
  via: string[];
}

export interface FileNode {
  file: ChangedFile;
  role: Role;
  adapter?: string;
  facts?: ModuleFacts;
}

export type GroupKind =
  | "context"
  | "story"
  | "mechanical"
  | "misc"
  | "generated";

export interface ReviewItem {
  path: string;
  role: Role;
  additions: number;
  deletions: number;
  status: FileStatus;
  /** Short human-readable reasons for the position. */
  notes: string[];
}

export interface ReviewGroup {
  kind: GroupKind;
  title: string;
  /** Which of the static misc groups this is; stays when the AI layer renames it. */
  section?: "config" | "standalone" | "tests";
  /** One sentence on what the group does for the change (from the AI layer). */
  purpose?: string;
  items: ReviewItem[];
}
