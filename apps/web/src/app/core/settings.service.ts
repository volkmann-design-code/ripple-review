import { computed, Injectable, signal } from "@angular/core";
import { DB_NAME, type Settings } from "../../engine/api";
import { forgetLastRepo } from "./last-repo";

const KEY = "ripple-review.settings";

/**
 * The user's GitHub token and Anthropic key (D22): kept in this browser only,
 * for this tab's session or, if the user chooses, on this device. Only the
 * engine's worker uses them, to call GitHub and Anthropic directly.
 */
@Injectable({ providedIn: "root" })
export class SettingsService {
  private readonly state = signal<Settings>(load());
  /** Whether the settings are kept on this device (localStorage) or for this session. */
  readonly remembered = signal(stored(local) !== undefined);

  readonly settings = this.state.asReadonly();
  readonly hasGitHub = computed(() => Boolean(this.state().githubToken));
  readonly hasAi = computed(() => Boolean(this.state().anthropicKey));

  /** The current settings; a new object after each change. */
  current(): Settings {
    return this.state();
  }

  save(settings: Settings, remember: boolean): void {
    const clean: Settings = {
      ...(settings.githubToken?.trim()
        ? { githubToken: settings.githubToken.trim() }
        : {}),
      ...(settings.anthropicKey?.trim()
        ? { anthropicKey: settings.anthropicKey.trim() }
        : {}),
    };
    write(remember ? local : session, clean);
    remove(remember ? session : local);
    this.state.set(clean);
    this.remembered.set(remember);
  }

  /** Forgets the token or the key, keeping the other where it is kept. */
  forget(which: keyof Settings): void {
    const { [which]: _, ...rest } = this.state();
    this.save(rest, this.remembered());
  }

  /**
   * Forgets everything this app keeps in the browser: the settings, ticks,
   * AI answers and cached file contents. Reload the page afterwards.
   */
  async clearAll(): Promise<void> {
    remove(local);
    remove(session);
    forgetLastRepo();
    this.state.set({});
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      // The worker closes its connection on `versionchange`; then this succeeds.
      req.onblocked = () => {};
    });
  }
}

// Getters: touching `localStorage` itself throws where site data is blocked.
const local = () => localStorage;
const session = () => sessionStorage;

function load(): Settings {
  return stored(session) ?? stored(local) ?? {};
}

function stored(storage: () => Storage): Settings | undefined {
  try {
    const raw = storage().getItem(KEY);
    return raw ? (JSON.parse(raw) as Settings) : undefined;
  } catch {
    return undefined;
  }
}

function write(storage: () => Storage, settings: Settings): void {
  try {
    storage().setItem(KEY, JSON.stringify(settings));
  } catch {
    // Kept in memory for this visit only.
  }
}

function remove(storage: () => Storage): void {
  try {
    storage().removeItem(KEY);
  } catch {
    // Nothing kept.
  }
}
