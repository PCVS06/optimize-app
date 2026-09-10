import { expect, test } from "vitest";
import type { WikiIndexEntry } from "@getpaseo/protocol/optimize-wiki";
import {
  mapWikiLinks,
  resolveWikiLink,
  wikiLinkTargets,
  wikiRelations,
} from "@getpaseo/protocol/wiki-links";
import { wikiAncestors, wikiSections } from "./wiki-structure";

const pages: WikiIndexEntry[] = [
  { id: "one", title: "Products", parentId: null, updatedAt: "", links: ["Care"] },
  { id: "two", title: "Care", parentId: "one", updatedAt: "", links: ["one"] },
];
test("stable links survive renames, title references are unambiguous, and backlinks follow the actual direction", () => {
  expect(resolveWikiLink({ target: "products", pages })?.id).toBe("one");
  const renamed = pages.map((page) => (page.id === "one" ? { ...page, title: "Catalog" } : page));
  expect(resolveWikiLink({ target: "one", pages: renamed })?.title).toBe("Catalog");
  expect(resolveWikiLink({ target: "Products", pages: renamed })).toBe(null);
  expect(
    resolveWikiLink({ target: "Care", pages: [...pages, { ...pages[1]!, id: "duplicate" }] }),
  ).toBe(null);
  expect(wikiRelations(pages)).toEqual([
    { source: "one", target: "two", kind: "link" },
    { source: "two", target: "one", kind: "parent" },
    { source: "two", target: "one", kind: "link" },
  ]);
  expect(wikiAncestors({ id: "two", pages }).map((page) => page.title)).toEqual(["Products"]);
});
test("links in prose resolve while examples inside code stay literal", () => {
  const body =
    "See [[Products]] and [[two|Care guide]]. `[[not a link]]`\n```md\n[[example]]\n```\n\\[[escaped]]";
  expect(wikiLinkTargets(body)).toEqual(["Products", "two"]);
  expect(mapWikiLinks({ body, replace: (_target, label) => `<${label}>` })).toContain(
    "<Products> and <Care guide>",
  );
});
test("table of contents preserves content and ignores headings inside code fences", () => {
  const body = "Intro\n## Care\nInstructions\n```md\n# Example\n```\n### Sources\nReferences";
  const sections = wikiSections(body);
  expect(sections.filter((entry) => entry.heading).map((entry) => entry.heading)).toEqual([
    "Care",
    "Sources",
  ]);
  expect(sections.map((entry) => entry.markdown).join("")).toBe(body + "\n");
});
