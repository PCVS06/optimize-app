import { expect, test } from "vitest";
import type { WikiPage } from "@getpaseo/protocol/optimize-wiki";
import { openWikiEditor, WikiConflictError } from "./wiki-editor-model";

const page: WikiPage = {
  id: "58bcbdb2-ae14-4b8b-b7ca-c87e98753c4b",
  revision: "ad8f64f2-1449-4a42-ae18-eb05dc7842f1",
  title: "Support",
  body: "Existing context",
  createdAt: "2026-09-10T12:00:00.000Z",
  updatedAt: "2026-09-10T12:00:00.000Z",
};

test("restoring content opens a publishable draft against the current revision", async () => {
  const model = openWikiEditor({
    page,
    initial: { title: "Earlier title", body: "Earlier content", parentId: null },
    write: async (input) => {
      expect(input.id).toBe(page.id);
      expect(input.expectedRevision).toBe(page.revision);
      expect(input.body).toBe("Earlier content");
      return { ...page, ...input };
    },
  });
  expect(model.getState().canSave).toBe(true);
  expect((await model.save())?.title).toBe("Earlier title");
});

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
    latest: null,
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

test("conflicts require review and preserve the complete draft when adopting the newer revision", async () => {
  const latest = {
    ...page,
    revision: "953df8d0-c224-4b09-b44c-f91ec64a8d46",
    body: "Colleague update",
  };
  let calls = 0;
  const model = openWikiEditor({
    page,
    write: async (input) => {
      calls++;
      if (calls === 1) throw new WikiConflictError(latest);
      expect(input.expectedRevision).toBe(latest.revision);
      return { ...latest, ...input };
    },
  });
  model.setBody("My draft");
  expect(await model.save()).toBe(null);
  expect(model.getState().latest).toEqual(latest);
  expect(model.getState().canSave).toBe(false);
  expect(await model.save()).toBe(null);
  expect(calls).toBe(1);
  model.setBody("My draft with colleague update");
  model.acceptLatest();
  expect(model.getBasePage()).toEqual(latest);
  expect(model.getState().body).toBe("My draft with colleague update");
  expect(model.getState().canSave).toBe(true);
  await expect(model.save()).resolves.toMatchObject({ body: "My draft with colleague update" });
});

test("new drafts keep one page ID across a failed publish and retry", async () => {
  const newPageId = "be43aeca-a1ec-462a-bb83-a157d8b9b7cc";
  const ids: Array<string | undefined> = [];
  const model = openWikiEditor({
    newPageId,
    write: async (input) => {
      ids.push(input.id);
      throw new Error("Disconnected");
    },
  });
  model.setTitle("Draft");
  await model.save();
  await model.save();
  expect(ids).toEqual([newPageId, newPageId]);
});
