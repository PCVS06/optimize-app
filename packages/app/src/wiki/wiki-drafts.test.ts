import { expect, test } from "vitest";
import { parseWikiDrafts, wikiDraftKey } from "./wiki-drafts";

test("separate new articles retain separate drafts, sorted by last edit and isolated by host", () => {
  const draft = {
    title: "Draft one",
    body: "Keep my text",
    parentId: null,
    parentTitle: "Wiki home",
    updatedAt: "2026-09-10T12:00:00.000Z",
  };
  const entries: Array<[string, string]> = [
    [wikiDraftKey("company", "first"), JSON.stringify(draft)],
    [
      wikiDraftKey("company", "second"),
      JSON.stringify({ ...draft, title: "Draft two", updatedAt: "2026-09-10T13:00:00.000Z" }),
    ],
    [wikiDraftKey("other", "private"), JSON.stringify(draft)],
    [wikiDraftKey("company", "unreadable"), "broken json"],
  ];
  const result = parseWikiDrafts("company", entries);
  expect(result.map((entry) => entry.id)).toEqual(["second", "first", "unreadable"]);
  expect(result[1]?.draft?.body).toBe("Keep my text");
  expect(result[2]?.draft).toBe(null);
});
