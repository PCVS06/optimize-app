import type { WikiIndexEntry } from "./optimize-wiki.js";

/** Wiki syntax is ignored inside fenced/inline code and escaped brackets. */
export function mapWikiLinks(input: {
  body: string;
  replace: (target: string, label: string) => string;
}): string {
  return input.body
    .split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g)
    .map((part, index) =>
      index % 2
        ? part
        : part.replace(
            /(?<!\\)\[\[([^\]\n|]+)(?:\|([^\]\n]+))?\]\]/g,
            (_match, target: string, label?: string) =>
              input.replace(target.trim(), (label ?? target).trim()),
          ),
    )
    .join("");
}
export function wikiLinkTargets(body: string): string[] {
  const targets = new Set<string>();
  mapWikiLinks({
    body,
    replace: (target) => {
      targets.add(target);
      return "";
    },
  });
  return [...targets];
}
export function resolveWikiLink(input: {
  target: string;
  pages: readonly WikiIndexEntry[];
}): WikiIndexEntry | null {
  const byId = input.pages.find((page) => page.id === input.target);
  if (byId) return byId;
  const normalized = input.target.trim().toLocaleLowerCase();
  const matches = input.pages.filter(
    (page) =>
      page.title.trim().toLocaleLowerCase() === normalized ||
      page.aliases?.some((alias) => alias.toLocaleLowerCase() === normalized),
  );
  return matches.length === 1 ? matches[0]! : null;
}
export function wikiRelations(pages: readonly WikiIndexEntry[]) {
  const links: Array<{ source: string; target: string; kind: "link" | "parent" }> = [];
  for (const page of pages) {
    if (page.parentId && pages.some((entry) => entry.id === page.parentId))
      links.push({ source: page.id, target: page.parentId, kind: "parent" });
    for (const target of page.links) {
      const resolved = resolveWikiLink({ target, pages });
      if (
        resolved &&
        !links.some(
          (link) => link.source === page.id && link.target === resolved.id && link.kind === "link",
        )
      )
        links.push({ source: page.id, target: resolved.id, kind: "link" });
    }
  }
  return links;
}
