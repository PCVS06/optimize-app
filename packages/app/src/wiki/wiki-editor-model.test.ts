import { expect, test } from "vitest";
import type { WikiPage } from "@getpaseo/protocol/optimize-wiki";
import { openWikiEditor } from "./wiki-editor-model";

const page: WikiPage = {
  id: "58bcbdb2-ae14-4b8b-b7ca-c87e98753c4b",
  revision: "ad8f64f2-1449-4a42-ae18-eb05dc7842f1",
  title: "Support",
  body: "Existing context",
  createdAt: "2026-09-10T12:00:00.000Z",
  updatedAt: "2026-09-10T12:00:00.000Z",
};

test("failed and conflicting saves preserve the complete editable draft", async () => {
  const model = openWikiEditor({
    page,
    write: async () => {
      throw new Error("Someone changed this page.");
    },
  });
  model.setTitle("New title");
  model.setBody("My unsaved context");
  expect(await model.save()).toBe(null);
  expect(model.getState()).toEqual({
    title: "New title",
    body: "My unsaved context",
    parentId: null,
    parentTitle: "Top level",
    status: "editing",
    error: "Someone changed this page.",
    canSave: true,
  });
});

test("new drafts do not inherit edited page identity, revision, or contents", async () => {
  const model = openWikiEditor({
    write: async (input) => {
      expect(input).toEqual({
        expectedRevision: null,
        title: "New page",
        body: "New context",
        parentId: null,
      });
      return { ...page, ...input };
    },
  });
  expect(model.getState().canSave).toBe(false);
  model.setTitle("  New page  ");
  model.setBody("New context");
  expect((await model.save())?.title).toBe("New page");
});

test("saving uses the opened revision and prevents double submission", async () => {
  let finish!: (result: WikiPage) => void;
  let writes = 0;
  const model = openWikiEditor({
    page,
    write: (input) => {
      writes++;
      expect(input.expectedRevision).toBe(page.revision);
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  model.setBody("Updated context");
  const saving = model.save();
  model.setBody("Late change");
  expect(await model.save()).toBe(null);
  expect(model.getState().body).toBe("Updated context");
  expect(writes).toBe(1);
  finish({ ...page, body: "Updated context" });
  expect(await saving).toMatchObject({ body: "Updated context" });
});

test("moving an article alone is a saveable change and keeps its selected parent on failure", async () => {
  const parentId = "8e60d821-d9ee-48da-981a-1c46e9a9d3eb";
  const model = openWikiEditor({
    page,
    write: async (input) => {
      expect(input.parentId).toBe(parentId);
      throw new Error("Conflict");
    },
  });
  model.setParent(parentId, "Products");
  expect(model.getState().canSave).toBe(true);
  await model.save();
  expect(model.getState()).toMatchObject({
    parentId,
    parentTitle: "Products",
    error: "Conflict",
    status: "editing",
  });
});
