import type { UseQueryResult } from "@tanstack/react-query";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { BookOpen, Plus, Pencil, ArrowLeft } from "lucide-react-native";
import { StyleSheet } from "react-native-unistyles";
import type { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import type { WikiPage, WikiPageSummary } from "@getpaseo/protocol/optimize-wiki";
import { MenuHeader } from "@/components/headers/menu-header";
import { Button } from "@/components/ui/button";
import { Field, FormTextInput } from "@/components/ui/form-field";
import { SearchField } from "@/components/ui/search-field";
import { MarkdownRenderer } from "@/components/markdown/renderer";
import { HostFilter } from "@/components/hosts/host-filter";
import { useIsCompactFormFactor } from "@/constants/layout";
import { getHostRuntimeStore, useHosts, useHostRuntimeSnapshot } from "@/runtime/host-runtime";
import { useHostFeature } from "@/runtime/host-features";
import { useFetchQuery } from "@/data/query";
import { queryClient } from "@/data/query-client";
import { openWikiEditor } from "@/wiki/wiki-editor-model";

export function OptimizeWikiScreen() {
  const hosts = useHosts();
  const [selectedHost, setSelectedHost] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const isFocused = useIsFocused();
  const host = hosts.find((entry) => entry.serverId === selectedHost) ?? hosts[0];
  const hostFilter = useMemo(
    () =>
      hosts.length > 1 && host && !editing ? (
        <HostFilter
          hosts={hosts}
          selectedHost={host.serverId}
          onSelectHost={setSelectedHost}
          includeAllHost={false}
        />
      ) : undefined,
    [hosts, host, editing],
  );
  return (
    <View style={styles.screen}>
      <MenuHeader title="Optimize Wiki" rightContent={hostFilter} />
      {host ? (
        <WikiHost
          key={host.serverId}
          serverId={host.serverId}
          active={isFocused}
          onEditingChange={setEditing}
        />
      ) : (
        <Text style={styles.message}>Connect to your Optimize host to open the company Wiki.</Text>
      )}
    </View>
  );
}

interface WikiHostProps {
  serverId: string;
  active: boolean;
  onEditingChange: (editing: boolean) => void;
}
function WikiHost({ serverId, active, onEditingChange }: WikiHostProps) {
  const runtime = useHostRuntimeSnapshot(serverId);
  const supportsWiki = useHostFeature(serverId, "optimizeWiki");
  const client = runtime?.client;
  const online = runtime?.connectionStatus === "online";
  return (
    <WikiWorkspace
      serverId={serverId}
      client={client ?? null}
      supportsWiki={supportsWiki}
      active={active}
      online={online}
      connectionEpoch={runtime?.connectionEpoch ?? 0}
      onEditingChange={onEditingChange}
    />
  );
}

interface WikiWorkspaceProps extends WikiHostProps {
  client: DaemonClient | null;
  supportsWiki: boolean;
  online: boolean;
  connectionEpoch: number;
}
function WikiWorkspace({
  serverId,
  client,
  supportsWiki,
  active,
  online,
  connectionEpoch,
  onEditingChange,
}: WikiWorkspaceProps) {
  const compact = useIsCompactFormFactor();
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ page?: WikiPage } | null>(null);
  const enabled = active && online && supportsWiki && Boolean(client);
  const list = useFetchQuery({
    queryKey: ["optimize-wiki", serverId, "search", search, offset, connectionEpoch],
    queryFn: async () => {
      if (!client) throw new Error("Optimize is disconnected.");
      const result = await client.searchWiki({ query: search, offset });
      if (!result.ok) throw new Error(result.error.message);
      return result;
    },
    enabled,
    dataShape: "list",
    staleTimeMs: 5000,
  });
  const openEditor = useCallback(
    (page?: WikiPage) => {
      setEditor({ page });
      onEditingChange(true);
    },
    [onEditingChange],
  );
  const newPage = useCallback(() => openEditor(), [openEditor]);
  const closeEditor = useCallback(() => {
    setEditor(null);
    onEditingChange(false);
  }, [onEditingChange]);
  const onSaved = useCallback(
    (saved: WikiPage) => {
      queryClient.setQueryData(
        ["optimize-wiki", serverId, "page", saved.id, connectionEpoch],
        saved,
      );
      void queryClient.invalidateQueries({ queryKey: ["optimize-wiki", serverId] });
      setSelectedId(saved.id);
      closeEditor();
    },
    [serverId, connectionEpoch, closeEditor],
  );
  const changeSearch = useCallback((value: string) => {
    setSearch(value);
    setOffset(0);
  }, []);
  const refetchList = list.refetch;
  const retry = useCallback(() => {
    void refetchList();
  }, [refetchList]);
  const back = useCallback(() => setSelectedId(null), []);
  const showDetails = Boolean(editor || selectedId);
  return (
    <View style={styles.content}>
      {online && !supportsWiki && (
        <Text style={styles.notice}>Update this Optimize host to use the built-in Wiki.</Text>
      )}
      {!online && <Text style={styles.notice}>Reconnecting to Optimize… Your draft is kept.</Text>}
      <View style={[styles.columns, compact && styles.columnsCompact]}>
        {(!compact || !showDetails) && (
          <WikiLibrary
            compact={compact}
            list={list}
            enabled={enabled}
            editing={Boolean(editor)}
            selectedId={selectedId}
            select={setSelectedId}
            search={search}
            onSearch={changeSearch}
            offset={offset}
            setOffset={setOffset}
            onNew={newPage}
            retry={retry}
          />
        )}
        {(!compact || showDetails) && (
          <View style={styles.detail}>
            {editor && (
              <WikiEditor
                key={editor.page?.id ?? "new"}
                page={editor.page}
                serverId={serverId}
                online={enabled}
                onSaved={onSaved}
                onCancel={closeEditor}
              />
            )}
            {!editor && selectedId && (
              <WikiReader
                serverId={serverId}
                id={selectedId}
                client={client}
                enabled={enabled}
                connectionEpoch={connectionEpoch}
                compact={compact}
                onEdit={openEditor}
                onBack={back}
              />
            )}
            {!showDetails && <WikiEmpty onCreate={newPage} enabled={enabled} />}
          </View>
        )}
      </View>
    </View>
  );
}

interface WikiListData {
  pages: WikiPageSummary[];
  total: number;
  nextOffset: number | null;
}
interface WikiLibraryProps {
  compact: boolean;
  list: UseQueryResult<WikiListData, Error>;
  enabled: boolean;
  editing: boolean;
  selectedId: string | null;
  select: (id: string) => void;
  search: string;
  onSearch: (value: string) => void;
  offset: number;
  setOffset: (offset: number) => void;
  onNew: () => void;
  retry: () => void;
}
function WikiLibrary({
  compact,
  list,
  enabled,
  editing,
  selectedId,
  select,
  search,
  onSearch,
  offset,
  setOffset,
  onNew,
  retry,
}: WikiLibraryProps) {
  const previous = useCallback(() => setOffset(Math.max(0, offset - 50)), [offset, setOffset]);
  const nextOffset = list.data?.nextOffset;
  const next = useCallback(() => {
    if (nextOffset != null) setOffset(nextOffset);
  }, [nextOffset, setOffset]);
  return (
    <View style={[styles.library, compact && styles.libraryCompact]}>
      <View style={styles.libraryHeading}>
        <Text style={styles.eyebrow}>COMPANY KNOWLEDGE</Text>
        <Button
          size="sm"
          variant="ghost"
          leftIcon={Plus}
          onPress={onNew}
          disabled={!enabled || editing}
          testID="wiki-new-page"
          accessibilityLabel="New Wiki page"
        >
          New page
        </Button>
      </View>
      <SearchField
        value={search}
        onChangeText={onSearch}
        placeholder="Search the Wiki…"
        clearAccessibilityLabel="Clear Wiki search"
        testID="wiki-search"
      />
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        <WikiList
          pages={list.data?.pages}
          error={list.error}
          search={search}
          selectedId={selectedId}
          disabled={editing}
          select={select}
          retry={retry}
        />
      </ScrollView>
      <View style={styles.pagination}>
        {list.data && <Text style={styles.muted}>{list.data.total} pages</Text>}
        {offset > 0 && (
          <Button size="sm" variant="ghost" onPress={previous}>
            Previous
          </Button>
        )}
        {nextOffset != null && (
          <Button size="sm" variant="ghost" onPress={next}>
            Next
          </Button>
        )}
      </View>
    </View>
  );
}

interface WikiListProps {
  pages?: WikiPageSummary[];
  error: Error | null;
  search: string;
  selectedId: string | null;
  disabled: boolean;
  select: (id: string) => void;
  retry: () => void;
}
function WikiList({ pages, error, search, selectedId, disabled, select, retry }: WikiListProps) {
  if (error)
    return (
      <View style={styles.messageBlock}>
        <Text style={styles.error}>{error.message}</Text>
        <Button size="sm" variant="ghost" onPress={retry}>
          Try again
        </Button>
      </View>
    );
  if (!pages) return <Text style={styles.muted}>Loading pages…</Text>;
  if (pages.length === 0)
    return (
      <Text style={styles.muted}>
        {search
          ? "No matching pages. Try different words."
          : "Your company knowledge starts here. Add your first page."}
      </Text>
    );
  return (
    <>
      {pages.map((page) => (
        <WikiRow
          key={page.id}
          page={page}
          selected={selectedId === page.id}
          disabled={disabled}
          select={select}
        />
      ))}
    </>
  );
}
function WikiRow({
  page,
  selected,
  disabled,
  select,
}: {
  page: WikiPageSummary;
  selected: boolean;
  disabled: boolean;
  select: (id: string) => void;
}) {
  const onPress = useCallback(() => select(page.id), [select, page.id]);
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={page.title}
      style={[styles.pageRow, selected && styles.pageRowSelected]}
      testID={`wiki-page-${page.id}`}
    >
      <Text numberOfLines={2} style={styles.pageTitle}>
        {page.title}
      </Text>
      <Text numberOfLines={2} style={styles.excerpt}>
        {page.excerpt || "Empty page"}
      </Text>
    </Pressable>
  );
}

interface WikiReaderProps {
  serverId: string;
  id: string;
  client: DaemonClient | null;
  enabled: boolean;
  connectionEpoch: number;
  compact: boolean;
  onEdit: (page: WikiPage) => void;
  onBack: () => void;
}
function WikiReader({
  serverId,
  id,
  client,
  enabled,
  connectionEpoch,
  compact,
  onEdit,
  onBack,
}: WikiReaderProps) {
  const query = useFetchQuery({
    queryKey: ["optimize-wiki", serverId, "page", id, connectionEpoch],
    queryFn: async () => {
      if (!client) throw new Error("Optimize is disconnected.");
      const result = await client.readWiki(id);
      if (!result.ok) throw new Error(result.error.message);
      return result.page;
    },
    enabled,
    dataShape: "value",
    staleTimeMs: 5000,
  });
  const edit = useCallback(() => {
    if (query.data) onEdit(query.data);
  }, [query.data, onEdit]);
  const refetchPage = query.refetch;
  const retry = useCallback(() => {
    void refetchPage();
  }, [refetchPage]);
  return (
    <ScrollView contentContainerStyle={styles.article}>
      <View style={styles.articleToolbar}>
        {compact ? (
          <Button size="sm" variant="ghost" leftIcon={ArrowLeft} onPress={onBack}>
            Pages
          </Button>
        ) : (
          <Text style={styles.eyebrow}>OPTIMIZE WIKI</Text>
        )}
        <Button
          size="sm"
          variant="secondary"
          leftIcon={Pencil}
          disabled={!enabled || !query.data || query.isFetching}
          onPress={edit}
          testID="wiki-edit-page"
        >
          Edit page
        </Button>
      </View>
      <WikiArticle page={query.data} error={query.error} retry={retry} />
    </ScrollView>
  );
}
function WikiArticle({
  page,
  error,
  retry,
}: {
  page?: WikiPage;
  error: Error | null;
  retry: () => void;
}) {
  if (error)
    return (
      <View>
        <Text style={styles.error}>{error.message}</Text>
        <Button size="sm" variant="ghost" onPress={retry}>
          Try again
        </Button>
      </View>
    );
  if (!page) return <Text style={styles.muted}>Opening page…</Text>;
  return (
    <>
      <Text selectable style={styles.title} testID="wiki-article-title">
        {page.title}
      </Text>
      <Text style={styles.updated}>
        Updated {new Date(page.updatedAt).toLocaleString()} · Available to the assistant
      </Text>
      <View testID="wiki-article-body">
        <MarkdownRenderer
          text={page.body || "This page is empty. Choose Edit page to add context."}
          enableHtmlish={false}
        />
      </View>
    </>
  );
}
function WikiEmpty({ onCreate, enabled }: { onCreate: () => void; enabled: boolean }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.title}>Knowledge for everyone.</Text>
      <Text style={styles.intro}>
        Product details, support guidance, and how Optimize works — in one place for your team and
        your assistant.
      </Text>
      <Button leftIcon={BookOpen} onPress={onCreate} disabled={!enabled} testID="wiki-create-first">
        Create a page
      </Button>
      <Text style={styles.caption}>Shared across projects on this Optimize host.</Text>
    </View>
  );
}

interface WikiEditorProps {
  page?: WikiPage;
  serverId: string;
  online: boolean;
  onSaved: (page: WikiPage) => void;
  onCancel: () => void;
}
function WikiEditor({ page, serverId, online, onSaved, onCancel }: WikiEditorProps) {
  const [model] = useState(() =>
    openWikiEditor({
      page,
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
  const compact = useIsCompactFormFactor();
  const size = compact ? "md" : "sm";
  const save = useCallback(async () => {
    const saved = await model.save();
    if (saved) onSaved(saved);
  }, [model, onSaved]);
  return (
    <ScrollView contentContainerStyle={styles.article} keyboardShouldPersistTaps="handled">
      <View style={styles.articleToolbar}>
        <Text style={styles.eyebrow}>{page ? "EDIT PAGE" : "NEW PAGE"}</Text>
        <View style={styles.actions}>
          <Button
            size={size}
            variant="ghost"
            onPress={onCancel}
            disabled={state.status === "saving"}
            testID="wiki-cancel"
          >
            Cancel
          </Button>
          <Button
            size={size}
            onPress={save}
            disabled={!online || !state.canSave}
            loading={state.status === "saving"}
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
          placeholder="For example: Product care and maintenance"
          maxLength={160}
          editable={state.status !== "saving"}
          accessibilityLabel="Wiki page title"
          testID="wiki-title-input"
        />
      </Field>
      <Field label="Knowledge" error={state.error}>
        <FormTextInput
          size={size}
          initialValue={state.body}
          onChangeText={model.setBody}
          placeholder="Add the facts, guidance, and source links your team and assistant should use. Markdown formatting is supported."
          multiline
          style={styles.editorBody}
          maxLength={100000}
          editable={state.status !== "saving"}
          accessibilityLabel="Wiki page content"
          testID="wiki-body-input"
        />
      </Field>
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.surface0 },
  content: { flex: 1 },
  columns: { flex: 1, flexDirection: "row" },
  columnsCompact: { flexDirection: "column" },
  library: {
    width: 290,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    padding: 20,
    gap: 16,
  },
  libraryCompact: { width: "100%", flex: 1, borderRightWidth: 0 },
  libraryHeading: { gap: 12, alignItems: "flex-start" },
  eyebrow: {
    color: theme.colors.foregroundMuted,
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: "600",
  },
  list: { flex: 1 },
  listContent: { gap: 6 },
  pageRow: { padding: 12, borderRadius: 12, gap: 6 },
  pageRowSelected: { backgroundColor: theme.colors.surface2 },
  pageTitle: { color: theme.colors.foreground, fontSize: 16, fontWeight: "500" },
  excerpt: { color: theme.colors.foregroundMuted, fontSize: 13, lineHeight: 19 },
  detail: { flex: 1, minWidth: 0 },
  article: { padding: 32, gap: 24, width: "100%", maxWidth: 900, alignSelf: "center" },
  articleToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  actions: { flexDirection: "row", gap: 8 },
  title: { color: theme.colors.foreground, fontSize: 30, lineHeight: 38, fontWeight: "600" },
  updated: { color: theme.colors.foregroundMuted, fontSize: 12 },
  empty: {
    flex: 1,
    padding: 36,
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 20,
    maxWidth: 660,
    alignSelf: "center",
  },
  intro: { color: theme.colors.foregroundMuted, fontSize: 17, lineHeight: 27 },
  caption: { color: theme.colors.foregroundMuted, fontSize: 12 },
  muted: { color: theme.colors.foregroundMuted, fontSize: 13, lineHeight: 20 },
  pagination: { flexDirection: "row", alignItems: "center", gap: 8 },
  editorBody: { minHeight: 380, textAlignVertical: "top" },
  error: { color: theme.colors.destructive, fontSize: 14 },
  notice: {
    padding: 12,
    color: theme.colors.foregroundMuted,
    backgroundColor: theme.colors.surface1,
  },
  message: { padding: 32, color: theme.colors.foregroundMuted },
  messageBlock: { gap: 12 },
}));
