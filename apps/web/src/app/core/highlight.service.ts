import { Injectable } from "@angular/core";
import type { HighlighterCore } from "shiki/core";
import { LANGS } from "./highlight-languages";

/** One highlighted piece of a line: its text and its colours (light and dark). */
export interface Token {
  text: string;
  style: Record<string, string>;
}

const extensionOf = (path: string) =>
  path.slice(path.lastIndexOf(".") + 1).toLowerCase();

/**
 * Syntax highlighting with Shiki (GitHub's light and dark themes), loaded
 * lazily: nothing is downloaded until the first diff is shown.
 */
@Injectable({ providedIn: "root" })
export class HighlightService {
  private highlighter?: Promise<HighlighterCore>;
  private readonly loaded = new Map<string, Promise<string | undefined>>();

  canHighlight(path: string): boolean {
    return extensionOf(path) in LANGS;
  }

  /** Tokens per line of `lines`, highlighted as one piece of `path`'s code. */
  async tokenize(
    path: string,
    lines: readonly string[],
  ): Promise<Token[][] | undefined> {
    const lang = await this.language(path);
    if (!lang) {
      return undefined;
    }
    const h = await this.core();
    const { tokens } = h.codeToTokens(lines.join("\n"), {
      lang,
      themes: { light: "github-light", dark: "github-dark" },
    });
    // Both colours as variables; styles.css picks one by the colour scheme.
    return tokens.map((line) =>
      line.map((t) => ({
        text: t.content,
        style: {
          "--shiki-light": t.htmlStyle?.["color"] ?? "inherit",
          "--shiki-dark": t.htmlStyle?.["--shiki-dark"] ?? "inherit",
        },
      })),
    );
  }

  private core(): Promise<HighlighterCore> {
    this.highlighter ??= (async () => {
      const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] =
        await Promise.all([
          import("shiki/core"),
          import("shiki/engine/javascript"),
        ]);
      return createHighlighterCore({
        themes: [
          import("shiki/themes/github-light.mjs"),
          import("shiki/themes/github-dark.mjs"),
        ],
        langs: [],
        engine: createJavaScriptRegexEngine(),
      });
    })();
    return this.highlighter;
  }

  /** Loads the file's language once; its name, or undefined if unknown. */
  private language(path: string): Promise<string | undefined> {
    const ext = extensionOf(path);
    const load = LANGS[ext];
    if (!load) {
      return Promise.resolve(undefined);
    }
    let p = this.loaded.get(ext);
    if (!p) {
      p = (async () => {
        const h = await this.core();
        const mod = await load();
        await h.loadLanguage(mod.default);
        const langs = Array.isArray(mod.default) ? mod.default : [mod.default];
        const last = langs.at(-1) as { name?: string } | undefined;
        return last?.name;
      })().catch(() => undefined);
      this.loaded.set(ext, p);
    }
    return p;
  }
}
