import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ScrollView, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import {
  WikiPageIdSchema,
  type WikiPage,
  type WikiIndexEntry,
} from "@getpaseo/protocol/optimize-wiki";
import { Button } from "@/components/ui/button";
import { FormTextInput } from "@/components/ui/form-field";
import { SelectField, type SelectFieldDisplay } from "@/components/ui/select-field";
import { confirmDialog } from "@/utils/confirm-dialog";
import { getHostRuntimeStore } from "@/runtime/host-runtime";
import { openWikiEditor, WikiConflictError } from "./wiki-editor-model";
import { wikiAncestors } from "./wiki-structure";
import { WikiRichEditor } from "./wiki-rich-editor";
import { WikiDraftSchema, wikiDraftKey, type WikiDraft } from "./wiki-drafts";
import { WikiDocument } from "./wiki-document";

function stayInEditor() {}

export interface WikiNewPage {
  title?: string;
  body?: string;
  parentId?: string | null;
}
interface EditorProps {
  page?: WikiPage;
  initial?: WikiNewPage;
  draftId: string;
  pages: readonly WikiIndexEntry[];
  serverId: string;
  online: boolean;
  onSaved: (page: WikiPage) => void;
  onCancel: () => void;
}
export function WikiEditor(props: EditorProps) {
  const key = wikiDraftKey(props.serverId, props.draftId);
  const [loaded, setLoaded] = useState<{ draft: WikiDraft | null; error: string | null } | null>(
    null,
  );
  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(key)
      .then((raw) => {
        let draft: WikiDraft | null = null;
        if (raw) {
          try {
            draft = WikiDraftSchema.parse(JSON.parse(raw));
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
  draftId,
  recovered,
  storageError,
}: EditorProps & { draftKey: string; recovered: WikiDraft | null; storageError: string | null }) {
  const page = recovered?.page ?? currentPage;
  const [draftError, setDraftError] = useState(storageError);
  const [source, setSource] = useState(false);
  const [draftStatus, setDraftStatus] = useState("Draft saved on this Mac");
  const [model] = useState(() =>
    openWikiEditor({
      page,
      newPageId: WikiPageIdSchema.safeParse(draftId).success
        ? draftId
        : globalThis.crypto.randomUUID(),
      latest:
        recovered?.page && currentPage?.revision !== recovered.page.revision
          ? currentPage
          : undefined,
      initial: recovered ?? initial,
      parentTitle:
        recovered?.parentTitle ??
        pages.find((entry) => entry.id === (initial?.parentId ?? page?.parentId))?.title ??
        "Wiki home",
      write: async (input) => {
        const client = getHostRuntimeStore().getSnapshot(serverId)?.client;
        if (!client) throw new Error("Optimize is disconnected. Your draft is kept.");
        const result = await client.writeWiki(input);
        if (!result.ok) {
          if (result.error.code === "conflict" && input.id) {
            const latest = await client.readWiki(input.id);
            if (latest.ok) throw new WikiConflictError(latest.page);
          }
          throw new Error(result.error.message);
        }
        return result.page;
      },
    }),
  );
  const state = useSyncExternalStore(model.subscribe, model.getState, model.getState);
  const [queue] = useState(() => ({ tail: Promise.resolve() }));
  useEffect(() => {
    function persistDraft() {
      const value = model.getState();
      if (value.status !== "editing") return;
      const base = model.getBasePage();
      const unchanged = !value.title && !value.body && !base;
      if (unchanged) return;
      const draft: WikiDraft = {
        page: base,
        title: value.title,
        body: value.body,
        parentId: value.parentId,
        parentTitle: value.parentTitle,
        updatedAt: new Date().toISOString(),
      };
      setDraftStatus("Saving draft…");
      queue.tail = queue.tail
        .then(() => AsyncStorage.setItem(draftKey, JSON.stringify(draft)))
        .then(() => {
          setDraftStatus("Draft saved on this Mac");
          setDraftError(null);
          return undefined;
        })
        .catch(() => {
          setDraftStatus("Draft not saved");
          setDraftError(
            "Draft could not be saved on this Mac. Keep the editor open or publish before leaving.",
          );
        });
    }
    if (!storageError) persistDraft();
    return model.subscribe(persistDraft);
  }, [model, draftKey, queue, storageError]);
  const save = useCallback(async () => {
    const saved = await model.save();
    if (!saved) return;
    await queue.tail;
    try {
      await AsyncStorage.setItem(
        draftKey,
        JSON.stringify({
          page: saved,
          title: saved.title,
          body: saved.body,
          parentId: saved.parentId ?? null,
          parentTitle: model.getState().parentTitle,
          updatedAt: saved.updatedAt,
        }),
      );
      await AsyncStorage.removeItem(draftKey);
    } catch {
      // New articles use a stable ID, so a retained draft cannot create a duplicate.
    }
    onSaved(saved);
  }, [model, onSaved, queue, draftKey]);
  const close = useCallback(async () => {
    await queue.tail;
    if (
      draftError &&
      !(await confirmDialog({
        title: "Leave without a saved draft?",
        message:
          "Local draft storage failed. Keep this editor open to preserve your text, or publish while connected.",
        confirmLabel: "Leave editor",
        destructive: true,
      }))
    )
      return;
    onCancel();
  }, [onCancel, queue, draftError]);
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
          <Text style={styles.muted}>{draftStatus} · only you can see it</Text>
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
        {state.latest && (
          <View style={styles.conflict} testID="wiki-conflict">
            <Text style={styles.error}>{state.error}</Text>
            <Text style={styles.muted}>Latest published version: {state.latest.title}</Text>
            <ScrollView style={styles.conflictPreview} nestedScrollEnabled>
              <WikiDocument body={state.latest.body} pages={pages} onOpen={stayInEditor} />
            </ScrollView>
            <Text style={styles.muted}>
              Your draft remains editable below. Bring any changes you want to keep into it, then
              confirm you have reviewed this version.
            </Text>
            <Button
              size="sm"
              variant="secondary"
              onPress={model.acceptLatest}
              testID="wiki-accept-latest"
            >
              I reviewed the latest version
            </Button>
          </View>
        )}
        {(recovered || state.canSave) && (
          <View style={styles.recovered}>
            <Text style={styles.muted}>
              {recovered ? "Your local draft was recovered." : "Unpublished changes"}
            </Text>
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
          style={articleTitleStyle}
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
            style={articleSourceStyle}
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
// FormTextInput splits chrome and text values; pass concrete static values rather
// than an Unistyles proxy, whose values are resolved on native view bindings.
const articleTitleStyle = {
  fontSize: 34,
  lineHeight: 44,
  borderWidth: 0,
  backgroundColor: "transparent",
  paddingHorizontal: 0,
  fontWeight: "600",
} as const;
const articleSourceStyle = { minHeight: 430, textAlignVertical: "top" } as const;
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
  editingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  muted: { color: theme.colors.foregroundMuted, fontSize: 12 },
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
  conflict: {
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
  },
  conflictPreview: { maxHeight: 240 },
}));
