import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ScrollView,
  Text,
  View,
  type NativeSyntheticEvent,
  type TextInputSelectionChangeEventData,
} from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { WikiPage, WikiIndexEntry } from "@getpaseo/protocol/optimize-wiki";
import { Button } from "@/components/ui/button";
import { Field, FormTextInput } from "@/components/ui/form-field";
import { SelectField, type SelectFieldDisplay } from "@/components/ui/select-field";
import type { EditingTextInputHandle } from "@/components/ui/text-input";
import { useIsCompactFormFactor } from "@/constants/layout";
import { getHostRuntimeStore } from "@/runtime/host-runtime";
import { openWikiEditor } from "./wiki-editor-model";
import { wikiAncestors } from "./wiki-structure";
import { WikiDocument } from "./wiki-document";

export function WikiEditor({
  page,
  pages,
  serverId,
  online,
  onSaved,
  onCancel,
}: {
  page?: WikiPage;
  pages: readonly WikiIndexEntry[];
  serverId: string;
  online: boolean;
  onSaved: (page: WikiPage) => void;
  onCancel: () => void;
}) {
  const [model] = useState(() =>
    openWikiEditor({
      page,
      parentTitle: pages.find((entry) => entry.id === page?.parentId)?.title ?? "Top level",
      write: async (input) => {
        const client = getHostRuntimeStore().getSnapshot(serverId)?.client;
        if (!client) throw new Error("Optimize is disconnected. Your draft is kept.");
        const result = await client.writeWiki(input);
        if (!result.ok) throw new Error(result.error.message);
        return result.page;
      },
    }),
  );
  const state = useSyncExternalStore(model.subscribe, model.getState, model.getState);
  const [preview, setPreview] = useState(false);
  const bodyInput = useRef<EditingTextInputHandle>(null);
  const selection = useRef({ start: 0, end: 0 });
  const compact = useIsCompactFormFactor();
  const size = compact ? "md" : "sm";
  const saving = state.status === "saving";
  const parentOptions = useMemo(
    () => [
      { id: "root", value: "", label: "Top level" },
      ...pages
        .filter(
          (entry) =>
            entry.id !== page?.id &&
            !wikiAncestors({ id: entry.id, pages }).some((parent) => parent.id === page?.id),
        )
        .map((entry) => ({
          id: entry.id,
          value: entry.id,
          label: entry.title,
          testID: `wiki-parent-option-${entry.id}`,
        })),
    ],
    [pages, page?.id],
  );
  const linkOptions = useMemo(
    () => pages.map((entry) => ({ id: entry.id, value: entry.id, label: entry.title })),
    [pages],
  );
  const save = useCallback(async () => {
    const saved = await model.save();
    if (saved) onSaved(saved);
  }, [model, onSaved]);
  const insert = useCallback(
    (before: string, after = "") => {
      const text = bodyInput.current?.getText() ?? model.getState().body;
      const start = Math.min(selection.current.start, text.length);
      const end = Math.min(selection.current.end, text.length);
      const middle = text.slice(start, end);
      const replacement = before + middle + after;
      const result = text.slice(0, start) + replacement + text.slice(end);
      model.setBody(result);
      bodyInput.current?.replaceText(result, {
        start: start + before.length,
        end: start + before.length + middle.length,
      });
      bodyInput.current?.focus();
    },
    [model],
  );
  const parentDisplay = useMemo(() => ({ label: state.parentTitle }), [state.parentTitle]);
  const chooseParent = useCallback(
    (id: string, display: SelectFieldDisplay) => model.setParent(id || null, display.label),
    [model],
  );
  const showWrite = useCallback(() => setPreview(false), []);
  const showPreview = useCallback(() => setPreview(true), []);
  const insertHeading = useCallback(() => insert("\n## "), [insert]);
  const insertBold = useCallback(() => insert("**", "**"), [insert]);
  const insertList = useCallback(() => insert("\n- "), [insert]);
  const insertTable = useCallback(
    () => insert("\n| Column | Detail |\n| --- | --- |\n| Item | Description |\n"),
    [insert],
  );
  const insertLink = useCallback(
    (id: string, display: SelectFieldDisplay) => insert(`[[${id}|${display.label}]]`),
    [insert],
  );
  const onSelection = useCallback(
    (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      selection.current = event.nativeEvent.selection;
    },
    [],
  );
  return (
    <ScrollView contentContainerStyle={styles.article} keyboardShouldPersistTaps="handled">
      <View style={styles.toolbar}>
        <Text style={styles.eyebrow}>{page ? "EDIT ARTICLE" : "NEW ARTICLE"}</Text>
        <View style={styles.actions}>
          <Button
            size={size}
            variant="ghost"
            onPress={onCancel}
            disabled={saving}
            testID="wiki-cancel"
          >
            Cancel
          </Button>
          <Button
            size={size}
            onPress={save}
            disabled={!online || !state.canSave}
            loading={saving}
            testID="wiki-save"
          >
            Save page
          </Button>
        </View>
      </View>
      <Field label="Page title">
        <FormTextInput
          size={size}
          initialValue={state.title}
          onChangeText={model.setTitle}
          placeholder="Give this article a title"
          maxLength={160}
          editable={!saving}
          accessibilityLabel="Wiki page title"
          testID="wiki-title-input"
        />
      </Field>
      <SelectField
        label="Inside"
        value={state.parentId ?? ""}
        selectedDisplay={parentDisplay}
        options={parentOptions}
        onChange={chooseParent}
        placeholder="Choose an overview page"
        emptyText="No pages"
        disabled={saving}
        searchable
        size={size}
        testID="wiki-parent"
        triggerTestID="wiki-parent-trigger"
      />
      <View style={styles.toolbar}>
        <View style={styles.actions}>
          <Button size="sm" variant={preview ? "ghost" : "secondary"} onPress={showWrite}>
            Write
          </Button>
          <Button
            size="sm"
            variant={preview ? "secondary" : "ghost"}
            onPress={showPreview}
            testID="wiki-preview"
          >
            Preview
          </Button>
        </View>
        <Text style={styles.hint}>Markdown · [[Article title]] links pages</Text>
      </View>
      {!preview && (
        <View style={styles.actions}>
          <Button size="sm" variant="ghost" onPress={insertHeading} disabled={saving}>
            Heading
          </Button>
          <Button size="sm" variant="ghost" onPress={insertBold} disabled={saving}>
            Bold
          </Button>
          <Button size="sm" variant="ghost" onPress={insertList} disabled={saving}>
            List
          </Button>
          <Button size="sm" variant="ghost" onPress={insertTable} disabled={saving}>
            Table
          </Button>
          <SelectField
            field={false}
            label="Insert article link"
            value={null}
            selectedDisplay={null}
            options={linkOptions}
            onChange={insertLink}
            placeholder="Link article…"
            emptyText="Create another article first"
            disabled={saving}
            searchable
            size="sm"
            triggerTestID="wiki-insert-link"
          />
        </View>
      )}
      <View style={preview ? styles.hidden : undefined}>
        <Field label="Knowledge" error={state.error}>
          <FormTextInput
            ref={bodyInput}
            size={size}
            initialValue={state.body}
            onChangeText={model.setBody}
            onSelectionChange={onSelection}
            placeholder="Write freely. Use headings, lists, tables and links to organize your knowledge."
            multiline
            style={styles.body}
            maxLength={100000}
            editable={!saving}
            accessibilityLabel="Wiki page content"
            testID="wiki-body-input"
          />
        </Field>
      </View>
      {preview && (
        <View style={styles.preview} testID="wiki-editor-preview">
          <WikiDocument
            body={state.body || "This article is empty."}
            pages={pages}
            onOpen={ignorePreviewLink}
          />
          {state.error && <Text style={styles.error}>{state.error}</Text>}
        </View>
      )}
    </ScrollView>
  );
}
const styles = StyleSheet.create((theme) => ({
  article: { padding: 28, gap: 20, flexGrow: 1 },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
  },
  actions: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  eyebrow: { color: theme.colors.foregroundMuted, fontSize: 11, letterSpacing: 1.4 },
  hint: { color: theme.colors.foregroundMuted, fontSize: 12 },
  body: { minHeight: 330, textAlignVertical: "top" },
  hidden: { display: "none" },
  preview: { minHeight: 330 },
  error: { color: theme.colors.destructive },
}));

function ignorePreviewLink() {}
