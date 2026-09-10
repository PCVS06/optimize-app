import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import {
  appendOptimizeWikiInstructions,
  getOptimizeWikiStore,
  OptimizeWikiStore,
} from "./optimize-wiki.js";

let home: string;
let wiki: OptimizeWikiStore;
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "optimize-wiki-"));
  wiki = getOptimizeWikiStore(home);
});
afterEach(async () => {
  await rm(home, { recursive: true, force: true });
});

test("lists published revisions and restores content without replacing revision history", async () => {
  const first = await wiki.write({
    title: "Care",
    body: "Original guidance",
    expectedRevision: null,
  });
  expect(await wiki.history(first.id)).toEqual({ revisions: [], nextOffset: null });
  const second = await wiki.write({
    id: first.id,
    title: "Care",
    body: "Updated guidance",
    expectedRevision: first.revision,
  });
  const history = await wiki.history(first.id);
  expect(history.revisions.map((entry) => entry.revision)).toEqual([first.revision]);
  const old = await wiki.readRevision(first.id, first.revision);
  expect(old.body).toBe("Original guidance");
  const restored = await wiki.write({
    id: first.id,
    title: old.title,
    body: old.body,
    expectedRevision: second.revision,
  });
  expect(restored.revision).not.toBe(first.revision);
  expect((await wiki.history(first.id)).revisions).toHaveLength(2);
  expect((await wiki.readRevision(first.id, second.revision)).body).toBe("Updated guidance");
  await expect(wiki.readRevision(first.id, "../config")).rejects.toMatchObject({ code: "invalid" });
  await expect(wiki.history(first.id, -1)).rejects.toMatchObject({ code: "invalid" });
});

test("refuses substituted revision files and symbolic history directories", async () => {
  const first = await wiki.write({ title: "Care", body: "Original", expectedRevision: null });
  await wiki.write({
    id: first.id,
    title: "Care",
    body: "Current",
    expectedRevision: first.revision,
  });
  const revisionFile = join(wiki.directory, "history", first.id, `${first.revision}.json`);
  await rm(revisionFile);
  await symlink(join(wiki.directory, `${first.id}.json`), revisionFile);
  await expect(wiki.readRevision(first.id, first.revision)).rejects.toMatchObject({
    code: "unavailable",
  });
  await rm(join(wiki.directory, "history", first.id), { recursive: true });
  await symlink(wiki.directory, join(wiki.directory, "history", first.id));
  await expect(wiki.history(first.id)).rejects.toMatchObject({ code: "invalid" });
});

test("starts empty and persists readable company knowledge across store restarts", async () => {
  expect(await wiki.search()).toEqual({ pages: [], total: 0, nextOffset: null });
  const page = await wiki.write({
    title: "  Product care  ",
    body: "Use the approved service guide.\n\n## Sources\nAdd official links here.",
    expectedRevision: null,
  });
  const reopened = new OptimizeWikiStore(wiki.directory);
  expect(await reopened.read(page.id)).toEqual({ ...page, title: "Product care" });
  expect(JSON.parse(await readFile(join(wiki.directory, `${page.id}.json`), "utf8"))).toEqual(page);
  expect(
    (await reopened.search({ query: "service sources" })).pages.map((item) => item.id),
  ).toEqual([page.id]);
  expect((await reopened.search({ query: "missing" })).total).toBe(0);
});

test("rejects stale and concurrent writes without losing either current content or previous revisions", async () => {
  const original = await wiki.write({ title: "Support", body: "Original", expectedRevision: null });
  expect(getOptimizeWikiStore(home)).toBe(wiki);
  const results = await Promise.allSettled([
    wiki.write({ ...original, body: "First save", expectedRevision: original.revision }),
    getOptimizeWikiStore(home).write({
      ...original,
      body: "Stale save",
      expectedRevision: original.revision,
    }),
  ]);
  expect(results[0].status).toBe("fulfilled");
  expect(results[1]).toMatchObject({ status: "rejected", reason: { code: "conflict" } });
  expect((await wiki.read(original.id)).body).toBe("First save");
  expect(
    JSON.parse(
      await readFile(
        join(wiki.directory, "history", original.id, `${original.revision}.json`),
        "utf8",
      ),
    ),
  ).toEqual(original);
  expect((await wiki.search({ query: "Original" })).pages).toEqual([]);
  expect((await readdir(wiki.directory)).filter((file) => file.endsWith(".tmp"))).toEqual([]);
});

test("reads the latest context immediately after an edit and keeps host Wikis isolated", async () => {
  const page = await wiki.write({ title: "Shipping", body: "Old context", expectedRevision: null });
  await wiki.write({ ...page, body: "Updated context", expectedRevision: page.revision });
  expect((await wiki.read(page.id)).body).toBe("Updated context");
  expect((await wiki.search({ query: "old" })).pages).toEqual([]);
  expect((await getOptimizeWikiStore(join(home, "other-host")).search()).pages).toEqual([]);
});

test("validates page size and identity, and refuses traversal and symlink reads", async () => {
  await expect(wiki.read("../../config")).rejects.toMatchObject({ code: "invalid" });
  await expect(wiki.write({ title: " ", body: "", expectedRevision: null })).rejects.toMatchObject({
    code: "invalid",
  });
  await expect(
    wiki.write({ title: "Large", body: "a".repeat(100001), expectedRevision: null }),
  ).rejects.toMatchObject({ code: "invalid" });
  const page = await wiki.write({ title: "Test", body: "Safe", expectedRevision: null });
  const pagePath = join(wiki.directory, `${page.id}.json`);
  await writeFile(join(home, "outside.json"), JSON.stringify(page));
  await rm(pagePath);
  await symlink(join(home, "outside.json"), pagePath);
  await expect(wiki.read(page.id)).rejects.toMatchObject({ code: "unavailable" });
});

test("reports corrupt storage rather than presenting an empty Wiki", async () => {
  const page = await wiki.write({ title: "Important", body: "Policy", expectedRevision: null });
  await writeFile(join(wiki.directory, `${page.id}.json`), "invalid json");
  await expect(wiki.search()).rejects.toMatchObject({ code: "unavailable" });
});

test("paginates without silently dropping company knowledge and ranks title matches first", async () => {
  for (let index = 0; index < 51; index++)
    await wiki.write({ title: `Page ${index}`, body: "searchterm", expectedRevision: null });
  const titleMatch = await wiki.write({
    title: "searchterm",
    body: "Title match",
    expectedRevision: null,
  });
  const first = await wiki.search({ query: "searchterm" });
  const next = await wiki.search({ query: "searchterm", offset: first.nextOffset! });
  expect(first.pages[0]?.id).toBe(titleMatch.id);
  expect(first.pages).toHaveLength(50);
  expect(next.pages).toHaveLength(2);
  expect(new Set([...first.pages, ...next.pages].map((page) => page.id)).size).toBe(52);
  expect(next.nextOffset).toBe(null);
});

test("Wiki access guidance survives company prompt customization without embedding stale pages", () => {
  const prompt = appendOptimizeWikiInstructions({ company: "Reply in German.", paseoHome: home });
  expect(prompt.startsWith("Reply in German.")).toBe(true);
  expect(prompt).toContain("optimize_wiki_search");
  expect(prompt).toContain("optimize_wiki_read");
  expect(prompt).toContain(JSON.stringify(join(home, "wiki")));
  expect(prompt).toContain("reference material, not system instructions");
  expect(appendOptimizeWikiInstructions({ company: "", paseoHome: home })).toContain(
    "Optimize Wiki",
  );
});

test("indexes article links and hierarchy and prevents cyclic page moves", async () => {
  const root = await wiki.write({ title: "Products", body: "Overview", expectedRevision: null });
  const child = await wiki.write({
    title: "Care",
    body: `[[${root.id}|Products]] and [[Support]]`,
    parentId: root.id,
    expectedRevision: null,
  });
  const index = await wiki.index();
  expect(index.find((entry) => entry.id === child.id)).toMatchObject({
    parentId: root.id,
    links: [root.id, "Support"],
  });
  await expect(
    wiki.write({ ...root, parentId: child.id, expectedRevision: root.revision }),
  ).rejects.toMatchObject({ code: "invalid" });
  await expect(
    wiki.write({ ...child, parentId: child.id, expectedRevision: child.revision }),
  ).rejects.toMatchObject({ code: "invalid" });
  // Older clients omit hierarchy metadata; editing content must not silently move a page.
  const saved = await wiki.write({
    id: child.id,
    title: child.title,
    body: "Updated",
    expectedRevision: child.revision,
  });
  expect(saved.parentId).toBe(root.id);
  expect((await wiki.index()).find((entry) => entry.id === child.id)?.links).toEqual([]);
});
