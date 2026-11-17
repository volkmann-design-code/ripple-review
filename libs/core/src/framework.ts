import type { AdapterContext, ModuleFacts, Role } from "./model.ts";

/**
 * What a framework adds to one changed file, on top of its language adapter:
 * conventions the framework always follows (a task file is queued by its
 * name, a template belongs to its component, a migration inlines fixtures).
 */
export interface FrameworkFacts {
  /** Names other files mention this file by (a task's identifier, a GraphQL field). */
  definitions?: string[];
  /** Repository paths this file is made of, read as its parts (includes, templates). */
  parts?: string[];
  /**
   * Files to read before this one, with how they relate: `{ path:
   * "blueprints/pages/project.yml", via: "model of" }` reads as "model of
   * project.yml".
   */
  dependsOn?: { path: string; via: string }[];
}

/** A file as a framework rule sees it. */
export interface FrameworkFile {
  path: string;
  /** Its text at head (before, if removed); undefined when binary or unreadable. */
  content?: string;
  /** What its language adapter found, if one parsed it. */
  facts?: ModuleFacts;
}

/**
 * One framework's conventions (D1 of the framework-rules effort). A rule
 * finds out itself whether the repository uses its framework, from paths
 * and from files the analysis reads anyway (`package.json`): recordings keep
 * only the files read.
 */
export interface FrameworkRule {
  id: string;
  /** Shown with the links it adds: "included by x.sql (graphile-migrate)". */
  name: string;
  /** Whether the repository uses the framework; reads what the rule needs later. */
  detect(ctx: AdapterContext): Promise<boolean>;
  /** Only called once `detect` said yes. */
  file?(f: FrameworkFile): FrameworkFacts | undefined;
  /** Consulted after the language adapter's hint. */
  roleHint?(path: string): Role | undefined;
}
