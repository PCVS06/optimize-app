import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ScrollView, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { z } from "zod";
import {
  WikiPageSchema,
  type WikiPage,
  type WikiIndexEntry,
} from "@getpaseo/protocol/optimize-wiki";
import { Button } from "@/components/ui/button";
import { FormTextInput } from "@/components/ui/form-field";
import { SelectField, type SelectFieldDisplay } from "@/components/ui/select-field";
import { confirmDialog } from "@/utils/confirm-dialog";
import { getHostRuntimeStore } from "@/runtime/host-runtime";
import { openWikiEditor } from "./wiki-editor-model";
import { wikiAncestors } from "./wiki-structure";
import { WikiRichEditor } from "./wiki-rich-editor";

export interface WikiNewPage {
  title?: string;
  body?: string;
  parentId?: string | null;
}
interface EditorProps {
  page?: WikiPage;
  initial?: WikiNewPage;
  pages: readonly WikiIndexEntry[];
  serverId: string;
  online: boolean;
  onSaved: (page: WikiPage) => void;
  onCancel: () => void;
}
const DraftSchema = z.object({
  page: WikiPageSchema.optional(),
  title: z.string().max(160),
  body: z.string().max(200000),
  parentId: z.string().uuid().nullable(),
  parentTitle: z.string(),
});
type Draft = z.infer<typeof DraftSchema>;
export function WikiEditor(props: EditorProps) {
  const key = `optimize.wiki.draft.${props.serverId}.${props.page?.id ?? "new"}`;
  const [loaded, setLoaded] = useState<{ draft: Draft | null; error: string | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(key)
      .then((raw) => {
        let draft: Draft | null = null;
        if (raw) {
          try {
            draft = DraftSchema.parse(JSON.parse(raw));
          } catch {
            /* Keep an unreadable draft on disk for recovery. */
          }
        }
        if (!cancelled)
          setLoaded({
            draft,
            error:
              raw && !draft
                ? "A previous draft could not be opened. Its saved copy has been kept."
                : null,
          });
        return undefined;
      })
      .catch(() => {
        if (!cancelled)
          setLoaded({
            draft: null,
            error: "Local draft storage is unavailable. Publish before closing the editor.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [key]);
  if (!loaded) return <Text style={styles.notice}>Opening article…</Text>;
  return (
    <WikiEditorForm
      {...props}
      draftKey={key}
      recovered={loaded.draft}
      storageError={loaded.error}
    />
  );
}
function WikiEditorForm({
  page: currentPage,
  initial,
  pages,
  serverId,
  online,
  onSaved,
  onCancel,
  draftKey,
  recovered,
  storageError,
}: EditorProps & { draftKey: string; recovered: Draft | null; storageError: string | null }) {
  const page = recovered?.page ?? currentPage;
  const [draftError, setDraftError] = useState(storageError);
  const [source, setSource] = useState(false);
  const [model] = useState(() =>
    openWikiEditor({
      page,
      initial: recovered ?? initial,
      parentTitle:
        recovered?.parentTitle ??
        pages.find((entry) => entry.id === (initial?.parentId ?? page?.parentId))?.title ??
        "Wiki home",
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
  const [queue] = useState(() => ({ tail: Promise.resolve() }));
  useEffect(() => {
    return model.subscribe(() => {
      const value = model.getState();
      if (value.status !== "editing") return;
      const draft: Draft = {
        page,
        title: value.title,
        body: value.body,
        parentId: value.parentId,
        parentTitle: value.parentTitle,
      };
      queue.tail = queue.tail
        .then(() => AsyncStorage.setItem(draftKey, JSON.stringify(draft)))
        .catch(() => {
          setDraftError("Draft could not be saved on this Mac. Publish before closing the editor.");
        });
    });
  }, [model, page, draftKey, queue]);
  const save = useCallback(async () => {
    const saved = await model.save();
    if (!saved) return;
    await queue.tail;
    try {
      await AsyncStorage.removeItem(draftKey);
    } catch {
      /* The server save succeeded; do not offer a duplicate save. */
    }
    onSaved(saved);
  }, [model, onSaved, queue, draftKey]);
  const close = useCallback(async () => {
    await queue.tail;
    onCancel();
  }, [onCancel, queue]);
  const discard = useCallback(async () => {
    if (
      !(await confirmDialog({
        title: "Discard this draft?",
        message:
          "The unpublished changes will be removed from this Mac. The published article stays available.",
        confirmLabel: "Discard draft",
        destructive: true,
      }))
    )
      return;
    await queue.tail;
    try {
      await AsyncStorage.removeItem(draftKey);
      onCancel();
    } catch {
      setDraftError("Could not remove the local draft. Try again.");
    }
  }, [draftKey, onCancel, queue]);
  const toggleSource = useCallback(() => setSource((value) => !value), []);
  const parentOptions = useMemo(
    () => [
      { id: "root", value: "", label: "Wiki home" },
      ...pages
        .filter(
          (entry) =>
            entry.id !== page?.id &&
            !wikiAncestors({ id: entry.id, pages }).some((ancestor) => ancestor.id === page?.id),
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
  const chooseParent = useCallback(
    (id: string, display: SelectFieldDisplay) => model.setParent(id || null, display.label),
    [model],
  );
  const parentDisplay = useMemo(() => ({ label: state.parentTitle }), [state.parentTitle]);
  const saving = state.status === "saving";
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.status}>
          <View style={styles.dot} />
          <Text style={styles.muted}>Draft · visible to you until published</Text>
        </View>
        <View style={styles.actions}>
          <Button size="sm" variant="ghost" onPress={close} disabled={saving} testID="wiki-cancel">
            Close
          </Button>
          <Button
            size="sm"
            onPress={save}
            disabled={!online || !state.canSave}
            loading={saving}
            testID="wiki-save"
          >
            Publish changes
          </Button>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.article} keyboardShouldPersistTaps="handled">
        {recovered && (
          <View style={styles.recovered}>
            <Text style={styles.muted}>Your local draft was recovered.</Text>
            <Button size="sm" variant="ghost" onPress={discard} disabled={saving}>
              Discard draft
            </Button>
          </View>
        )}
        <SelectField
          field={false}
          label="Parent page"
          value={state.parentId ?? ""}
          selectedDisplay={parentDisplay}
          options={parentOptions}
          onChange={chooseParent}
          placeholder="Wiki home"
          emptyText="No pages"
          disabled={saving}
          searchable
          size="sm"
          triggerTestID="wiki-parent-trigger"
        />
        <FormTextInput
          initialValue={state.title}
          onChangeText={model.setTitle}
          placeholder="Untitled page"
          maxLength={160}
          editable={!saving}
          accessibilityLabel="Wiki page title"
          testID="wiki-title-input"
          style={styles.title}
        />
        <View style={styles.editingHeader}>
          <Text style={styles.muted}>Write, format, and link your company knowledge.</Text>
          <Button size="sm" variant="ghost" onPress={toggleSource} disabled={saving}>
            {source ? "Visual editor" : "Markdown source"}
          </Button>
        </View>
        {source ? (
          <FormTextInput
            key="source"
            initialValue={state.body}
            onChangeText={model.setBody}
            multiline
            editable={!saving}
            accessibilityLabel="Markdown source"
            testID="wiki-body-input"
            style={styles.source}
          />
        ) : (
          <WikiRichEditor
            key="visual"
            initialValue={state.body}
            onChange={model.setBody}
            disabled={saving}
            pages={pages}
          />
        )}
        {(state.error || draftError) && (
          <Text style={styles.error}>{state.error || draftError}</Text>
        )}
        {!online && (
          <Text style={styles.error}>
            Offline. Your draft stays on this Mac; reconnect to publish.
          </Text>
        )}
        <Text style={styles.footer}>
          {state.body.length.toLocaleString()} / 100,000 characters · Published pages become
          available to the team and assistant.
        </Text>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  status: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.foregroundMuted },
  actions: { flexDirection: "row", gap: 8, alignItems: "center" },
  article: { padding: 36, gap: 18, maxWidth: 940, width: "100%", alignSelf: "center", flexGrow: 1 },
  title: {
    fontSize: 34,
    lineHeight: 44,
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    fontWeight: "600",
  },
  editingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  muted: { color: theme.colors.foregroundMuted, fontSize: 12 },
  source: { minHeight: 430, textAlignVertical: "top" },
  error: { color: theme.colors.destructive, fontSize: 13 },
  footer: { color: theme.colors.foregroundMuted, fontSize: 11, lineHeight: 18 },
  recovered: {
    padding: 12,
    backgroundColor: theme.colors.surface1,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  notice: { padding: 32, color: theme.colors.foregroundMuted },
}));
