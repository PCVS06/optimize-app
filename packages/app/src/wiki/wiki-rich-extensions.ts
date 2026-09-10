import { Node, mergeAttributes } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { TableKit } from "@tiptap/extension-table";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Image } from "@tiptap/extension-image";

// A real inline node keeps Wiki links intact through rich editing and Markdown export.
export const WikiLinkNode = Node.create({
  name: "wikiLink",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return { target: { default: "" }, label: { default: "" } };
  },
  parseHTML() {
    return [
      {
        tag: "span[data-wiki-link]",
        getAttrs: (element) => ({
          target: element.getAttribute("data-wiki-link"),
          label: element.textContent,
        }),
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-wiki-link": node.attrs.target,
        class: "wiki-inline-link",
        contenteditable: "false",
      }),
      node.attrs.label || node.attrs.target,
    ];
  },
  renderText({ node }) {
    return node.attrs.label || node.attrs.target;
  },
  markdownTokenizer: {
    name: "wikiLink",
    level: "inline",
    start: "[[",
    tokenize(source) {
      const match = /^\[\[([^\]\n]+)\]\]/.exec(source);
      if (!match) return;
      const [target, ...label] = match[1].split("|");
      return {
        type: "wikiLink",
        raw: match[0],
        target: target.trim(),
        label: label.join("|").trim() || target.trim(),
      };
    },
  },
  parseMarkdown(token, helpers) {
    return helpers.createNode("wikiLink", { target: token.target, label: token.label });
  },
  renderMarkdown(node) {
    const target = String(node.attrs?.target ?? "").replace(/[\]\n|]/g, " ");
    const label = String(node.attrs?.label ?? target).replace(/[\]\n|]/g, " ");
    return `[[${target}|${label}]]`;
  },
});

export function wikiRichExtensions() {
  return [
    StarterKit.configure({
      link: { openOnClick: false },
      underline: false,
      heading: { levels: [1, 2, 3] },
    }),
    Markdown.configure({ markedOptions: { gfm: true } }),
    TableKit.configure({ table: { resizable: true } }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Image,
    WikiLinkNode,
    Placeholder.configure({ placeholder: "Start writing, or type / to insert a block…" }),
  ];
}
