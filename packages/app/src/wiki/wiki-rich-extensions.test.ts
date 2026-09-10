// @vitest-environment jsdom
import { afterEach, expect, test } from "vitest";
import { Editor } from "@tiptap/core";
import { wikiRichExtensions } from "./wiki-rich-extensions";

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});
function open(markdown: string) {
  const editor = new Editor({
    element: document.createElement("div"),
    extensions: wikiRichExtensions(),
    content: markdown,
    contentType: "markdown",
  });
  editors.push(editor);
  return editor;
}
test("rich editing preserves Wiki links, headings, lists, tables, and code examples", () => {
  const source =
    "## Product care\n\nSee [[7ab122a2-a36d-4525-8792-99e460ee4158|Products]] and [[Support]].\n\n- First\n- Second\n\n- [ ] Check this\n- [x] Done\n\n| Property | Value |\n| --- | --- |\n| Material | Verified |\n\n```text\n[[Literal example]]\n```";
  const editor = open(source);
  const json = JSON.stringify(editor.getJSON());
  expect(json).toContain('"type":"wikiLink"');
  expect(json).toContain('"type":"table"');
  expect(json).toContain('"type":"taskList"');
  const exported = editor.getMarkdown();
  expect(exported).toContain("[[7ab122a2-a36d-4525-8792-99e460ee4158|Products]]");
  expect(exported).toContain("[[Support|Support]]");
  expect(exported).toContain("[[Literal example]]");
  expect(open(exported).getJSON()).toEqual(editor.getJSON());
});
test("links inserted as inline nodes survive publish and reopen", () => {
  const editor = open("Read the ");
  editor.commands.insertContentAt(editor.state.doc.content.size - 1, {
    type: "wikiLink",
    attrs: { target: "7ab122a2-a36d-4525-8792-99e460ee4158", label: "Product catalog" },
  });
  const published = editor.getMarkdown();
  expect(published).toContain("[[7ab122a2-a36d-4525-8792-99e460ee4158|Product catalog]]");
  expect(open(published).getText()).toContain("Product catalog");
});
