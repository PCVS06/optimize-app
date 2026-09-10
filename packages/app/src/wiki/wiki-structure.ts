import type { WikiIndexEntry } from "@getpaseo/protocol/optimize-wiki";

export function wikiSections(body: string) {
  const sections: Array<{ index: number; heading: string; level: number; markdown: string }> = [];
  let section = { index: 0, heading: "", level: 0, markdown: "" };
  let fence = "";
  for (const line of body.split("\n")) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = "";
    }
    const heading = !fence && !marker ? /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line) : null;
    if (heading) {
      if (section.markdown.trim()) sections.push(section);
      section = {
        index: sections.length,
        heading: heading[2]!,
        level: heading[1]!.length,
        markdown: "",
      };
    }
    section.markdown += line + "\n";
  }
  if (section.markdown.trim()) sections.push(section);
  return sections;
}
export function wikiAncestors(input: { id: string; pages: readonly WikiIndexEntry[] }) {
  const result: WikiIndexEntry[] = [];
  const visited = new Set([input.id]);
  let parent = input.pages.find((page) => page.id === input.id)?.parentId;
  while (parent && !visited.has(parent)) {
    visited.add(parent);
    const page = input.pages.find((entry) => entry.id === parent);
    if (!page) break;
    result.unshift(page);
    parent = page.parentId;
  }
  return result;
}
