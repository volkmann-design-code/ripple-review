/** Text helpers shared by the pages. */

/** When something happened, roughly: "just now", "3 hours ago", "12 Nov". */
export function ago(iso: string, now = new Date()): string {
  const then = new Date(iso);
  const minutes = Math.round((now.getTime() - then.getTime()) / 60_000);
  if (Number.isNaN(minutes)) {
    return "";
  }
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return hours === 1 ? "an hour ago" : `${hours} hours ago`;
  }
  const days = Math.round(hours / 24);
  if (days < 7) {
    return days === 1 ? "yesterday" : `${days} days ago`;
  }
  return then.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(then.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

/** A size in characters as about that many bytes: "4 KB", "1.2 MB". */
export function size(chars: number): string {
  if (chars < 1000) {
    return "< 1 KB";
  }
  if (chars < 1_000_000) {
    return `${Math.round(chars / 1000)} KB`;
  }
  return `${(chars / 1_000_000).toFixed(1)} MB`;
}

/** "1 file", "3 files". */
export function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** An error's message, whatever was thrown. */
export function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
