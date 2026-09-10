import type { WikiIndexEntry } from "@getpaseo/protocol/optimize-wiki";
import { wikiAncestors } from "./wiki-structure";

export function wikiTreeRows(
  pages: readonly WikiIndexEntry[],
  expanded: ReadonlySet<string>,
  selectedId: string | null,
) {
  const ids = new Set(pages.map((page) => page.id));
  const children = new Map<string | null, WikiIndexEntry[]>();
  for (const page of pages) {
    const parent = page.parentId && ids.has(page.parentId) ? page.parentId : null;
    const group = children.get(parent) ?? [];
    group.push(page);
    children.set(parent, group);
  }
  const opened = new Set([
    ...expanded,
    ...(selectedId ? wikiAncestors({ id: selectedId, pages }).map((page) => page.id) : []),
  ]);
  const rows: { page: WikiIndexEntry; depth: number; hasChildren: boolean; expanded: boolean }[] =
    [];
  const visited = new Set<string>();
  function walk(parent: string | null, depth: number) {
    for (const page of children.get(parent) ?? []) {
      if (visited.has(page.id)) continue;
      visited.add(page.id);
      const hasChildren = Boolean(children.get(page.id)?.length);
      rows.push({ page, depth, hasChildren, expanded: opened.has(page.id) });
      if (opened.has(page.id)) walk(page.id, depth + 1);
    }
  }
  walk(null, 0);
  return rows;
}
export function wikiExcerpt(value: string) {
  return value
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/!?(?:\[([^\]]+)\])\([^)]*\)/g, "$1")
    .replace(/[#*_>`|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
