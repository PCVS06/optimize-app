import {
  saveMemoryDraft,
  clearMemoryDraft,
  readMemoryDraft,
  type MemoryDraft,
} from "./memory-draft";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useFetchQuery } from "@/data/query";
import { StyleSheet } from "react-native-unistyles";
import type { MemoryRecord } from "@getpaseo/protocol/optimize-memory";
import { useHostRuntimeClient, useHostRuntimeIsConnected } from "@/runtime/host-runtime";
import { useHostFeature } from "@/runtime/host-features";
import { Button } from "@/components/ui/button";
import { ConfirmationSheet } from "@/components/confirmation-sheet";
import { Field, FormTextInput } from "@/components/ui/form-field";
import { SelectField } from "@/components/ui/select-field";
import { confirmDialog } from "@/utils/confirm-dialog";

export function MemoryPage({ serverId }: { serverId: string }) {
  const supported = useHostFeature(serverId, "optimizeMemory");
  const online = useHostRuntimeIsConnected(serverId);
  return (
    <View style={styles.page} testID="memory-page">
      <Text style={styles.title}>Memory</Text>
      <Text style={styles.description}>
        Keep useful facts and preferences across conversations. You decide what is remembered and
        can change or forget it here.
      </Text>
      {supported ? (
        <MemoryWorkspace key={serverId} serverId={serverId} online={online} />
      ) : (
        <Text style={styles.description}>Update the Optimize host to manage memory.</Text>
      )}
    </View>
  );
}
function MemoryWorkspace({ serverId, online }: { serverId: string; online: boolean }) {
  const client = useHostRuntimeClient(serverId);
  const [scope, setScope] = useState("company");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<MemoryRecord | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recovered, setRecovered] = useState<MemoryDraft | null>(null);
  const [restoring, setRestoring] = useState<MemoryDraft | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [removalTarget, setRemovalTarget] = useState<MemoryRecord | null>(null);
  const [removalError, setRemovalError] = useState<string | null>(null);
  const projectId = scope === "company" ? null : scope;
  useEffect(() => {
    let active = true;
    void readMemoryDraft(serverId)
      .then((draft) => {
        if (active) setRecovered(draft);
        return;
      })
      .catch((err) => {
        if (active) setError(String(err));
      });
    return () => {
      active = false;
    };
  }, [serverId]);
  const projects = useFetchQuery({
    dataShape: "value",
    staleTimeMs: 0,
    queryKey: ["memory-projects", serverId],
    enabled: online && !!client,
    queryFn: async () => {
      if (!client) throw new Error("Connect to Optimize.");
      return client.listProjects();
    },
  });
  const records = useFetchQuery({
    dataShape: "value",
    staleTimeMs: 0,
    queryKey: ["optimize-memory", serverId, scope, query, offset],
    enabled: online && !!client,
    queryFn: async () => {
      if (!client) throw new Error("Connect to Optimize.");
      const result = await client.listMemory({ projectId, query, offset });
      if (!result.ok) throw new Error(result.error);
      return result;
    },
  });
  const refetchRecords = records.refetch;
  const selectScope = useCallback((value: string) => {
    setScope(value);
    setOffset(0);
    setError(null);
  }, []);
  const search = useCallback((value: string) => {
    setQuery(value);
    setOffset(0);
  }, []);
  const create = useCallback(() => {
    setRestoring(null);
    setEditing("new");
  }, []);
  const cancel = useCallback(() => setEditing(null), []);
  const saved = useCallback(() => {
    setEditing(null);
    setRestoring(null);
    setRecovered(null);
    void refetchRecords();
  }, [refetchRecords]);
  const refresh = useCallback(() => {
    void refetchRecords();
  }, [refetchRecords]);
  const previous = useCallback(() => setOffset((value) => Math.max(0, value - 50)), []);
  const next = useCallback(
    () => setOffset(records.data?.nextOffset ?? 0),
    [records.data?.nextOffset],
  );
  const restore = useCallback(() => {
    if (!recovered) return;
    setRestoring(recovered);
    setScope(recovered.projectId ?? "company");
    setEditing(recovered.record ?? "new");
    setRecovered(null);
  }, [recovered]);
  const discard = useCallback(async () => {
    if (
      !(await confirmDialog({
        title: "Discard saved draft?",
        message: "This unpublished memory draft will be removed from this Mac.",
        confirmLabel: "Discard",
        cancelLabel: "Keep draft",
        destructive: true,
      }))
    )
      return;
    try {
      await clearMemoryDraft(serverId);
      setRecovered(null);
    } catch (err) {
      setError(String(err));
    }
  }, [serverId]);
  const discardPress = useCallback(() => {
    void discard();
  }, [discard]);
  const remove = useCallback((record: MemoryRecord) => {
    setRemovalTarget(record);
    setRemovalError(null);
  }, []);
  const cancelRemoval = useCallback(() => {
    if (removing !== null) return;
    setRemovalTarget(null);
    setRemovalError(null);
  }, [removing]);
  const confirmRemoval = useCallback(async () => {
    if (!removalTarget || removing !== null) return;
    if (!client || !online) {
      setRemovalError("Connect to Optimize to forget this memory.");
      return;
    }
    setRemoving(removalTarget.id);
    setRemovalError(null);
    try {
      const response = await client.removeMemory({
        id: removalTarget.id,
        expectedRevision: removalTarget.revision,
      });
      if (!response.ok) throw new Error(response.error);
      setRemovalTarget(null);
      await refetchRecords();
    } catch (err) {
      setRemovalError(err instanceof Error ? err.message : "Memory could not be removed.");
    } finally {
      setRemoving(null);
    }
  }, [client, online, removalTarget, removing, refetchRecords]);
  const options = useMemo(
    () => [
      { id: "company", value: "company", label: "Company — all chats" },
      ...(projects.data?.projects ?? [])
        .filter((project) => project.companyKind !== "chats")
        .map((project) => ({
          id: project.projectId,
          value: project.projectId,
          label: project.projectCustomName ?? project.projectDisplayName,
        })),
    ],
    [projects.data],
  );
  const selectedDisplay = useMemo(
    () => ({ label: options.find((option) => option.value === scope)?.label ?? "Project memory" }),
    [options, scope],
  );
  return (
    <View style={styles.page}>
      <ConfirmationSheet
        visible={removalTarget !== null}
        title="Forget this memory?"
        message={`“${removalTarget?.title ?? ""}” will no longer be supplied as remembered context. Its original conversation and source remain.`}
        confirmLabel="Forget"
        pending={removing !== null}
        error={removalError}
        onConfirm={confirmRemoval}
        onCancel={cancelRemoval}
        testID="memory-forget-confirmation"
      />
      <SelectField
        label="Where this memory applies"
        value={scope}
        selectedDisplay={selectedDisplay}
        placeholder="Choose scope"
        emptyText="No projects yet"
        options={options}
        onChange={selectScope}
        disabled={editing !== null}
        testID="memory-scope"
      />
      <Text style={styles.description}>
        {projectId
          ? "These memories are used only in this project. Company memories also apply."
          : "These memories apply to every conversation on this Optimize host and are visible to people with access to it. Save personal or project-only details in the appropriate project."}{" "}
        Changes apply from the next message. Chat history is kept separately; the assistant does not
        automatically share private emails or conversations as company memory.
      </Text>
      {!online && <Text style={styles.error}>Offline. Connect to load or save memory.</Text>}
      {editing !== null ? (
        <MemoryEditor
          key={editing === "new" ? `new-${scope}` : editing.id}
          record={editing === "new" ? null : editing}
          projectId={projectId}
          serverId={serverId}
          online={online}
          onCancel={cancel}
          onSaved={saved}
          draft={restoring}
        />
      ) : (
        <>
          {recovered && (
            <View style={styles.card}>
              <Text style={styles.heading}>Unpublished memory draft</Text>
              <Text style={styles.description}>{recovered.title || "Untitled memory"}</Text>
              <View style={styles.actions}>
                <Button onPress={restore}>Continue editing</Button>
                <Button variant="ghost" onPress={discardPress}>
                  Discard draft
                </Button>
              </View>
            </View>
          )}
          <View style={styles.actions}>
            <Button onPress={create} disabled={!online || recovered !== null} testID="memory-add">
              Add memory
            </Button>
            <Button variant="ghost" onPress={refresh} disabled={!online}>
              Refresh
            </Button>
          </View>
          <FormTextInput
            initialValue=""
            onChangeText={search}
            placeholder="Search memories"
            accessibilityLabel="Search memories"
          />
          <MemoryResults
            error={error}
            query={query}
            data={records.data}
            loading={records.isLoading}
            readError={records.error?.message}
            offset={offset}
            online={online}
            removing={removing}
            hasDraft={recovered !== null}
            onEdit={setEditing}
            onRemove={remove}
            onPrevious={previous}
            onNext={next}
          />
        </>
      )}
    </View>
  );
}
interface MemoryListData {
  records: MemoryRecord[];
  total: number;
  nextOffset: number | null;
}
function MemoryResults({
  error,
  query,
  data,
  loading,
  readError,
  offset,
  online,
  removing,
  hasDraft,
  onEdit,
  onRemove,
  onPrevious,
  onNext,
}: {
  error: string | null;
  query: string;
  data: MemoryListData | undefined;
  loading: boolean;
  readError: string | undefined;
  offset: number;
  online: boolean;
  removing: string | null;
  hasDraft: boolean;
  onEdit: (record: MemoryRecord) => void;
  onRemove: (record: MemoryRecord) => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <>
      {" "}
      {(error || readError) && <Text style={styles.error}>{error ?? readError}</Text>}
      {loading && <Text style={styles.description}>Loading memories…</Text>}
      {data && (
        <Text style={styles.description}>
          {data.total} saved {data.total === 1 ? "memory" : "memories"}
        </Text>
      )}
      {data?.records.length === 0 && (
        <View style={styles.card}>
          <Text style={styles.heading}>
            {query ? "No matching memories" : "Nothing remembered here yet"}
          </Text>
          <Text style={styles.description}>
            Add a fact here, or tell the assistant “Remember this for this project…” or “Remember
            this for the company…”.
          </Text>
        </View>
      )}
      {data?.records.map((record) => (
        <MemoryRow
          key={record.id}
          record={record}
          onEdit={onEdit}
          onRemove={onRemove}
          disabled={!online || removing !== null || hasDraft}
          removing={removing === record.id}
        />
      ))}
      <View style={styles.actions}>
        {offset > 0 && (
          <Button variant="outline" onPress={onPrevious}>
            Previous
          </Button>
        )}
        {data?.nextOffset != null && (
          <Button variant="outline" onPress={onNext}>
            Next
          </Button>
        )}
      </View>
    </>
  );
}
function MemoryRow({
  record,
  onEdit,
  onRemove,
  disabled,
  removing,
}: {
  record: MemoryRecord;
  onEdit: (record: MemoryRecord) => void;
  onRemove: (record: MemoryRecord) => void;
  disabled: boolean;
  removing: boolean;
}) {
  const edit = useCallback(() => onEdit(record), [onEdit, record]);
  const remove = useCallback(() => {
    void onRemove(record);
  }, [onRemove, record]);
  return (
    <View style={styles.card} testID="memory-record">
      <Text style={styles.heading}>{record.title}</Text>
      <Text style={styles.body}>{record.body}</Text>
      <Text style={styles.description}>
        {record.source ? `Source: ${record.source} · ` : ""}Updated{" "}
        {new Date(record.updatedAt).toLocaleDateString()}
      </Text>
      <View style={styles.actions}>
        <Button variant="outline" size="sm" onPress={edit} disabled={disabled}>
          Edit
        </Button>
        <Button variant="ghost" size="sm" onPress={remove} disabled={disabled}>
          {removing ? "Forgetting…" : "Forget"}
        </Button>
      </View>
    </View>
  );
}
function memoryEditorValues(draft: MemoryDraft | null, record: MemoryRecord | null) {
  return draft ?? record ?? { title: "", body: "", source: "" };
}
function memoryIsDirty(
  record: MemoryRecord | null,
  value: { title: string; body: string; source: string },
) {
  const original = memoryEditorValues(null, record);
  return (
    value.title !== original.title ||
    value.body !== original.body ||
    value.source !== original.source
  );
}
function MemoryEditor({
  record,
  projectId,
  serverId,
  online,
  onCancel,
  onSaved,
  draft,
}: {
  draft: MemoryDraft | null;
  record: MemoryRecord | null;
  projectId: string | null;
  serverId: string;
  online: boolean;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const client = useHostRuntimeClient(serverId);
  const initial = memoryEditorValues(draft, record);
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [source, setSource] = useState(initial.source);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = memoryIsDirty(record, { title, body, source });
  const [draftStatus, setDraftStatus] = useState("");
  useEffect(() => {
    if (!dirty) return;
    let active = true;
    setDraftStatus("Saving draft…");
    void saveMemoryDraft(serverId, { record, projectId, title, body, source })
      .then(() => {
        if (active) setDraftStatus("Draft saved on this Mac.");
        return;
      })
      .catch(() => {
        if (active) setDraftStatus("Draft could not be saved on this Mac. Keep this page open.");
      });
    return () => {
      active = false;
    };
  }, [serverId, record, projectId, title, body, source, dirty]);
  const cancelEdit = useCallback(async () => {
    if (
      dirty &&
      !(await confirmDialog({
        title: "Discard changes?",
        message: "The saved memory will stay unchanged. Your unpublished edits will be discarded.",
        confirmLabel: "Discard",
        cancelLabel: "Keep editing",
        destructive: true,
      }))
    )
      return;
    try {
      await clearMemoryDraft(serverId);
      onCancel();
    } catch (err) {
      setError(String(err));
    }
  }, [dirty, serverId, onCancel]);
  const cancelPress = useCallback(() => {
    void cancelEdit();
  }, [cancelEdit]);
  const save = useCallback(async () => {
    if (!client) return;
    setBusy(true);
    setError(null);
    try {
      const result = await client.writeMemory({
        id: record?.id,
        expectedRevision: record?.revision ?? null,
        projectId,
        title,
        body,
        source,
      });
      if (!result.ok) throw new Error(result.error);
      await clearMemoryDraft(serverId);
      onSaved();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Memory could not be saved. Your edits remain here.",
      );
    } finally {
      setBusy(false);
    }
  }, [client, record, projectId, title, body, source, onSaved, serverId]);
  const savePress = useCallback(() => {
    void save();
  }, [save]);
  return (
    <View style={styles.card} testID="memory-editor">
      <Text style={styles.heading}>{record ? "Edit memory" : "New memory"}</Text>
      <Field label="Title">
        <FormTextInput
          editable={!busy}
          initialValue={title}
          onChangeText={setTitle}
          maxLength={160}
          placeholder="For example: preferred language"
          accessibilityLabel="Memory title"
          testID="memory-title"
        />
      </Field>
      <Field label="What should be remembered?">
        <FormTextInput
          editable={!busy}
          initialValue={body}
          onChangeText={setBody}
          maxLength={6000}
          multiline
          numberOfLines={6}
          placeholder="Write a clear fact or preference, including relevant dates."
          accessibilityLabel="Memory content"
          testID="memory-body"
        />
      </Field>
      <Field label="Source or context (optional)">
        <FormTextInput
          editable={!busy}
          initialValue={source}
          onChangeText={setSource}
          maxLength={1000}
          placeholder="Who confirmed this, or a link to its source"
          accessibilityLabel="Memory source"
        />
      </Field>
      <Text style={styles.description}>{draftStatus}</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.actions}>
        <Button
          onPress={savePress}
          disabled={!online || busy || !title.trim() || !body.trim()}
          testID="memory-save"
        >
          {busy ? "Saving…" : "Save memory"}
        </Button>
        <Button variant="ghost" onPress={cancelPress} disabled={busy}>
          Cancel
        </Button>
      </View>
    </View>
  );
}
const styles = StyleSheet.create((theme) => ({
  page: { gap: 20 },
  title: { fontSize: 28, fontWeight: "600", color: theme.colors.foreground },
  description: { fontSize: 14, lineHeight: 21, color: theme.colors.foregroundMuted },
  heading: { fontSize: 17, fontWeight: "600", color: theme.colors.foreground },
  body: { fontSize: 15, lineHeight: 23, color: theme.colors.foreground },
  card: { gap: 14, padding: 20, borderRadius: 14, backgroundColor: theme.colors.surface1 },
  actions: { flexDirection: "row", gap: 10, alignItems: "center" },
  error: { color: theme.colors.destructive, fontSize: 14, lineHeight: 21 },
}));
