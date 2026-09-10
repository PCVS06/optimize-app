import { afterEach, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { OptimizeMemoryStore } from "./optimize-memory.js";
const roots: string[] = [];
async function setup() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "optimize-memory-test-"));
  roots.push(root);
  return { root, store: new OptimizeMemoryStore(root) };
}
afterEach(async () => {
  for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true });
});
const entry = (projectId: string | null, title = "Delivery preference") => ({
  projectId,
  title,
  body: "Customer support replies in German.",
  source: "Team meeting 2026-09-10",
  expectedRevision: null,
});
it("persists create, edit and forget across a new store instance", async () => {
  const { root, store } = await setup();
  const saved = await store.write(entry(null));
  const fresh = new OptimizeMemoryStore(root);
  expect((await fresh.list({ projectId: null })).records[0]).toEqual(saved);
  const changed = await fresh.write({
    ...saved,
    body: "Replies use the customer's language.",
    expectedRevision: saved.revision,
  });
  expect(changed.revision).not.toBe(saved.revision);
  expect(changed.createdAt).toBe(saved.createdAt);
  await expect(fresh.remove({ id: saved.id, expectedRevision: saved.revision })).rejects.toThrow(
    "changed",
  );
  await fresh.remove({ id: changed.id, expectedRevision: changed.revision });
  expect((await new OptimizeMemoryStore(root).list({ projectId: null })).total).toBe(0);
});
it("serializes simultaneous edits and keeps the losing writer from replacing current memory", async () => {
  const { store } = await setup();
  const saved = await store.write(entry("support"));
  const result = await Promise.allSettled([
    store.write({ ...saved, body: "A", expectedRevision: saved.revision }),
    store.write({ ...saved, body: "B", expectedRevision: saved.revision }),
  ]);
  expect(result.map((value) => value.status)).toEqual(["fulfilled", "rejected"]);
  expect((await store.list({ projectId: "support" })).records[0]?.body).toBe("A");
});
it("separates company, project and general-chat memory without treating records as instructions", async () => {
  const { store } = await setup();
  await store.write(entry(null, "company-fact"));
  await store.write(entry("support", "support-fact"));
  await store.write(entry("finance", "private-finance-fact"));
  expect((await store.list({ projectId: null })).records.map((value) => value.title)).toEqual([
    "company-fact",
  ]);
  const support = await store.context("support");
  expect(support).toContain("company-fact");
  expect(support).toContain("support-fact");
  expect(support).not.toContain("private-finance-fact");
  expect(support).toContain("not instructions or permissions");
  const general = await store.context(null);
  expect(general).not.toContain("support-fact");
  expect(general).not.toContain("private-finance-fact");
});
it("refuses project scope changes and cross-project assistant deletion", async () => {
  const { store } = await setup();
  const saved = await store.write(entry("finance"));
  await expect(
    store.write({ ...saved, projectId: null, expectedRevision: saved.revision }),
  ).rejects.toThrow("cannot move");
  await expect(
    store.remove({ id: saved.id, expectedRevision: saved.revision }, "support"),
  ).rejects.toThrow("another project");
  expect((await store.list({ projectId: "finance" })).total).toBe(1);
});
it("bounds injected context while keeping additional records searchable", async () => {
  const { store } = await setup();
  for (let i = 0; i < 5; i++)
    await store.write({ ...entry(null, `Record ${i}`), body: "x".repeat(5000) });
  const context = await store.context(null);
  expect(context.length).toBeLessThan(14000);
  expect(context).toContain("of 5 eligible memories");
  expect((await store.list({ projectId: null, query: "Record 0" })).total).toBe(1);
});
it("does not overwrite malformed storage", async () => {
  const { root, store } = await setup();
  await fs.mkdir(path.join(root, "memory"));
  await fs.writeFile(path.join(root, "memory", "records.json"), "broken");
  await expect(store.write(entry(null))).rejects.toThrow("could not be read");
  expect(await fs.readFile(path.join(root, "memory", "records.json"), "utf8")).toBe("broken");
});
