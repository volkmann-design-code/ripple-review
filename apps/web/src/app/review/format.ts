/** Small text helpers for the review components. */

export function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

export function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? "" : path.slice(0, i + 1);
}

export function statusLabel(status: string): string {
  switch (status) {
    case "added":
      return "new";
    case "removed":
      return "deleted";
    case "renamed":
      return "renamed";
    default:
      return "";
  }
}

export const KIND_LABEL: Record<string, string> = {
  context: "context",
  story: "story",
  mechanical: "same edit",
  misc: "",
  generated: "generated",
};
