import type { ChangeSet, ReviewGroup } from "@ripple-review/core/model";

export function renderMarkdown(cs: ChangeSet, groups: ReviewGroup[]): string {
  const files = groups.flatMap((g) => g.items);
  const add = files.reduce((s, f) => s + f.additions, 0);
  const del = files.reduce((s, f) => s + f.deletions, 0);
  const genLines = groups
    .filter((g) => g.kind === "generated")
    .flatMap((g) => g.items)
    .reduce((s, f) => s + f.additions + f.deletions, 0);

  const out: string[] = [];
  out.push(`# Review order: ${cs.title ?? "change"}`);
  if (cs.url) {
    out.push(cs.url);
  }
  out.push("");
  out.push(
    `${files.length} files · +${add} −${del} · ${groups.length} groups` +
      (genLines ? ` · ${genLines} changed lines are generated` : ""),
  );

  let n = 0;
  groups.forEach((g, gi) => {
    const gAdd = g.items.reduce((s, f) => s + f.additions, 0);
    const gDel = g.items.reduce((s, f) => s + f.deletions, 0);
    out.push(
      "",
      `## ${gi + 1}. ${g.title}`,
      `_${g.items.length} files · +${gAdd} −${gDel}_`,
      "",
    );
    if (g.purpose) {
      out.push(g.purpose, "");
    }
    for (const it of g.items) {
      n++;
      const name = cs.fileLink
        ? `[${it.path}](${cs.fileLink(it.path)})`
        : `\`${it.path}\``;
      const status =
        it.status === "added"
          ? " (new)"
          : it.status === "removed"
            ? " (deleted)"
            : it.status === "renamed"
              ? " (renamed)"
              : "";
      const role = it.role === "source" ? "" : ` · ${it.role}`;
      // Outside stories, only the AI layer's reasons for a move are shown.
      const shown =
        g.kind === "story"
          ? it.notes
          : it.notes.filter((n) => n.startsWith("placed here"));
      const notes = shown.length ? ` · ${shown.join("; ")}` : "";
      out.push(
        `${n}. [ ] ${name}${status} +${it.additions} −${it.deletions}${role}${notes}`,
      );
    }
  });
  return `${out.join("\n")}\n`;
}
