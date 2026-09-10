import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ScrollView, Text, View } from "react-native";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Undo2,
  Redo2,
  Link,
  Image as ImageIcon,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { ChoiceButton } from "@/components/ui/choice-button";
import { FormTextInput } from "@/components/ui/form-field";
import { SelectField, type SelectFieldDisplay } from "@/components/ui/select-field";
import type { WikiRichEditorProps } from "./wiki-rich-editor";
import { wikiRichExtensions } from "./wiki-rich-extensions";
import "./wiki-rich-editor.css";
import type { Theme } from "@/styles/theme";
function ColoredEditorContent({ editor, color }: { editor: Editor; color?: string }) {
  const style = useMemo(() => ({ color }), [color]);
  return <EditorContent style={style} editor={editor} />;
}
const ThemedEditorContent = withUnistyles(ColoredEditorContent);
const editorColors = (theme: Theme) => ({ color: theme.colors.foreground });

const blocks = [
  { id: "text", value: "text", label: "Text" },
  { id: "h1", value: "h1", label: "Heading 1" },
  { id: "h2", value: "h2", label: "Heading 2" },
  { id: "h3", value: "h3", label: "Heading 3" },
  { id: "bullet", value: "bullet", label: "Bullet list" },
  { id: "number", value: "number", label: "Numbered list" },
  { id: "check", value: "check", label: "Checklist" },
  { id: "quote", value: "quote", label: "Quote" },
  { id: "table", value: "table", label: "Table" },
  { id: "divider", value: "divider", label: "Divider" },
];
function applyBlock(editor: Editor, type: string) {
  const chain = editor.chain().focus();
  switch (type) {
    case "h1":
      return chain.toggleHeading({ level: 1 }).run();
    case "h2":
      return chain.toggleHeading({ level: 2 }).run();
    case "h3":
      return chain.toggleHeading({ level: 3 }).run();
    case "bullet":
      return chain.toggleBulletList().run();
    case "number":
      return chain.toggleOrderedList().run();
    case "check":
      return chain.toggleTaskList().run();
    case "quote":
      return chain.toggleBlockquote().run();
    case "table":
      return chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    case "divider":
      return chain.setHorizontalRule().run();
    default:
      return chain.setParagraph().run();
  }
}
function slashQuery(editor: Editor) {
  const { $from, empty } = editor.state.selection;
  if (!empty || $from.parent.type.name !== "paragraph") return null;
  return /^\/([a-z0-9 ]*)$/i.exec($from.parent.textBetween(0, $from.parentOffset))?.[1] ?? null;
}

export function WikiRichEditor({ initialValue, onChange, disabled, pages }: WikiRichEditorProps) {
  const change = useRef(onChange);
  change.current = onChange;
  const editor = useEditor({
    extensions: wikiRichExtensions(),
    content: initialValue,
    contentType: "markdown",
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        class: "optimize-wiki-prose",
        "data-testid": "wiki-rich-content",
        "aria-label": "Article content",
      },
    },
    onUpdate: ({ editor: current }) => change.current(current.getMarkdown()),
  });
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);
  if (!editor) return <Text>Opening editor…</Text>;
  return <RichDocument editor={editor} pages={pages} disabled={disabled} />;
}

function RichDocument({
  editor,
  pages,
  disabled,
}: {
  editor: Editor;
  pages: WikiRichEditorProps["pages"];
  disabled: boolean;
}) {
  const current = useEditorState({
    editor,
    selector: ({ editor: value }) => ({
      bold: value.isActive("bold"),
      italic: value.isActive("italic"),
      table: value.isActive("table"),
      block: value.isActive("heading") ? `h${value.getAttributes("heading").level}` : "text",
      slash: slashQuery(value),
    }),
  });
  const [slashIndex, setSlashIndex] = useState(0);
  const surface = useRef<HTMLDivElement>(null);
  const [slashDismissed, setSlashDismissed] = useState(false);
  const [anchor, setAnchor] = useState({ top: 0, left: 0 });
  useEffect(() => {
    setSlashDismissed(false);
    setSlashIndex(0);
  }, [current.slash]);
  const [linkMode, setLinkMode] = useState<"link" | "image" | null>(null);
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const options = useMemo(
    () =>
      pages.map((page) => ({
        id: page.id,
        value: page.id,
        label: page.title,
        testID: `wiki-link-option-${page.id}`,
      })),
    [pages],
  );
  const commands = useMemo(
    () => blocks.filter((block) => block.label.toLowerCase().includes(current.slash ?? "")),
    [current.slash],
  );
  useEffect(() => {
    if (current.slash === null || !surface.current) return;
    const caret = editor.view.coordsAtPos(editor.state.selection.from);
    const bounds = surface.current.getBoundingClientRect();
    const height = Math.min(360, commands.length * 36 + 48);
    const below = window.innerHeight - caret.bottom;
    const top =
      below < height && caret.top > height
        ? caret.top - bounds.top - height
        : caret.bottom - bounds.top + 8;
    setAnchor({ top, left: Math.max(0, Math.min(caret.left - bounds.left, bounds.width - 300)) });
  }, [current.slash, editor, commands.length]);
  const chooseBlock = useCallback(
    (type: string) => {
      applyBlock(editor, type);
    },
    [editor],
  );
  const chooseLink = useCallback(
    (target: string, display: SelectFieldDisplay) => {
      editor
        .chain()
        .focus()
        .insertContent({ type: "wikiLink", attrs: { target, label: display.label } })
        .run();
    },
    [editor],
  );
  const chooseSlash = useCallback(
    (type: string) => {
      const query = slashQuery(editor);
      if (query !== null) {
        const from = editor.state.selection.from;
        editor
          .chain()
          .focus()
          .deleteRange({ from: from - query.length - 1, to: from })
          .run();
      }
      applyBlock(editor, type);
      setSlashIndex(0);
    },
    [editor],
  );
  const onKey = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (current.slash === null || commands.length === 0 || slashDismissed) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setSlashDismissed(true);
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        setSlashIndex(
          (index) =>
            (index + (event.key === "ArrowDown" ? 1 : commands.length - 1)) % commands.length,
        );
      } else if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        chooseSlash(commands[slashIndex % commands.length].value);
      }
    },
    [commands, current.slash, slashIndex, chooseSlash, slashDismissed],
  );
  const bold = useCallback(() => {
    editor.chain().focus().toggleBold().run();
  }, [editor]);
  const italic = useCallback(() => {
    editor.chain().focus().toggleItalic().run();
  }, [editor]);
  const bullets = useCallback(() => chooseBlock("bullet"), [chooseBlock]);
  const numbered = useCallback(() => chooseBlock("number"), [chooseBlock]);
  const quote = useCallback(() => chooseBlock("quote"), [chooseBlock]);
  const undo = useCallback(() => {
    editor.chain().focus().undo().run();
  }, [editor]);
  const redo = useCallback(() => {
    editor.chain().focus().redo().run();
  }, [editor]);
  const row = useCallback(() => {
    editor.chain().focus().addRowAfter().run();
  }, [editor]);
  const column = useCallback(() => {
    editor.chain().focus().addColumnAfter().run();
  }, [editor]);
  const deleteRow = useCallback(() => {
    editor.chain().focus().deleteRow().run();
  }, [editor]);
  const deleteTable = useCallback(() => {
    editor.chain().focus().deleteTable().run();
  }, [editor]);
  const showLink = useCallback(() => {
    setLinkMode("link");
    setUrl("");
    setUrlError(null);
  }, []);
  const showImage = useCallback(() => {
    setLinkMode("image");
    setUrl("");
    setUrlError(null);
  }, []);
  const closeLink = useCallback(() => setLinkMode(null), []);
  const applyUrl = useCallback(() => {
    const value = url.trim();
    if (!/^https?:\/\//i.test(value)) {
      setUrlError("Enter a full https:// address.");
      return;
    }
    if (linkMode === "image") editor.chain().focus().setImage({ src: value }).run();
    else if (editor.state.selection.empty)
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text: value,
          marks: [{ type: "link", attrs: { href: value } }],
        })
        .run();
    else editor.chain().focus().setLink({ href: value }).run();
    setLinkMode(null);
  }, [editor, linkMode, url]);
  const blockDisplay = useMemo(
    () => ({ label: blocks.find((block) => block.value === current.block)?.label ?? "Text" }),
    [current.block],
  );
  return (
    <View style={styles.document}>
      <View style={styles.toolbar} testID="wiki-formatting-toolbar">
        <SelectField
          field={false}
          label="Block type"
          value={current.block}
          selectedDisplay={blockDisplay}
          options={blocks}
          onChange={chooseBlock}
          placeholder="Text"
          emptyText="No blocks"
          size="sm"
          disabled={disabled}
          triggerTestID="wiki-block-type"
        />
        <Button
          size="sm"
          variant={current.bold ? "secondary" : "ghost"}
          leftIcon={Bold}
          onPress={bold}
          accessibilityLabel="Bold"
          disabled={disabled}
        />
        <Button
          size="sm"
          variant={current.italic ? "secondary" : "ghost"}
          leftIcon={Italic}
          onPress={italic}
          accessibilityLabel="Italic"
          disabled={disabled}
        />
        <Button
          size="sm"
          variant="ghost"
          leftIcon={List}
          onPress={bullets}
          accessibilityLabel="Bullet list"
          disabled={disabled}
        />
        <Button
          size="sm"
          variant="ghost"
          leftIcon={ListOrdered}
          onPress={numbered}
          accessibilityLabel="Numbered list"
          disabled={disabled}
        />
        <Button
          size="sm"
          variant="ghost"
          leftIcon={Quote}
          onPress={quote}
          accessibilityLabel="Quote"
          disabled={disabled}
        />
        <Button
          size="sm"
          variant="ghost"
          leftIcon={Link}
          onPress={showLink}
          accessibilityLabel="Web link"
          disabled={disabled}
        />
        <Button
          size="sm"
          variant="ghost"
          leftIcon={ImageIcon}
          onPress={showImage}
          accessibilityLabel="Image URL"
          disabled={disabled}
        />
        <SelectField
          field={false}
          label="Link to article"
          value={null}
          selectedDisplay={null}
          options={options}
          onChange={chooseLink}
          placeholder="Link article"
          emptyText="Create another article first"
          searchable
          size="sm"
          disabled={disabled}
          triggerTestID="wiki-insert-link"
        />
        <Button
          size="sm"
          variant="ghost"
          leftIcon={Undo2}
          onPress={undo}
          accessibilityLabel="Undo"
          disabled={disabled}
        />
        <Button
          size="sm"
          variant="ghost"
          leftIcon={Redo2}
          onPress={redo}
          accessibilityLabel="Redo"
          disabled={disabled}
        />
      </View>
      {current.table && (
        <View style={styles.toolbar}>
          <Button size="sm" variant="ghost" onPress={row} disabled={disabled}>
            Add row
          </Button>
          <Button size="sm" variant="ghost" onPress={column} disabled={disabled}>
            Add column
          </Button>
          <Button size="sm" variant="ghost" onPress={deleteRow} disabled={disabled}>
            Remove row
          </Button>
          <Button size="sm" variant="ghost" onPress={deleteTable} disabled={disabled}>
            Remove table
          </Button>
        </View>
      )}
      {linkMode && (
        <View style={styles.url}>
          <FormTextInput
            key={linkMode}
            initialValue=""
            onChangeText={setUrl}
            placeholder="https://…"
            accessibilityLabel={linkMode === "image" ? "Image URL" : "Web address"}
            size="sm"
          />
          <Button size="sm" onPress={applyUrl}>
            Insert
          </Button>
          <Button size="sm" variant="ghost" onPress={closeLink}>
            Cancel
          </Button>
          {urlError && <Text style={styles.error}>{urlError}</Text>}
        </View>
      )}
      <div ref={surface} className="wiki-editor-surface" onKeyDownCapture={onKey}>
        <ThemedEditorContent uniProps={editorColors} editor={editor} />
        {current.slash !== null && commands.length > 0 && !slashDismissed && (
          <ScrollView
            style={[styles.commands, anchor]}
            contentContainerStyle={styles.commandContent}
            testID="wiki-slash-menu"
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.muted}>INSERT A BLOCK</Text>
            {commands.map((command, index) => (
              <ChoiceButton
                key={command.id}
                size="sm"
                variant={index === slashIndex % commands.length ? "secondary" : "ghost"}
                value={command.value}
                onSelect={chooseSlash}
              >
                {command.label}
              </ChoiceButton>
            ))}
          </ScrollView>
        )}
      </div>
    </View>
  );
}
const styles = StyleSheet.create((theme) => ({
  document: { minHeight: 430 },
  toolbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 3,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  url: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    paddingVertical: 10,
  },
  commands: {
    position: "absolute",
    zIndex: 20,
    width: 300,
    maxWidth: "100%",
    maxHeight: 360,

    backgroundColor: theme.colors.surface1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
  },
  commandContent: { padding: 12, gap: 4 },
  muted: { color: theme.colors.foregroundMuted, fontSize: 11, letterSpacing: 1 },
  error: { color: theme.colors.destructive, fontSize: 12 },
}));
