import { useCallback, useMemo, useState, useRef, type ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { Plus, Pencil, ArrowLeft, Star, History, Trash2 } from "lucide-react-native";
import { StyleSheet } from "react-native-unistyles";
import type { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import type { WikiPage, WikiIndexEntry } from "@getpaseo/protocol/optimize-wiki";
import { MenuHeader } from "@/components/headers/menu-header";
import { Button } from "@/components/ui/button";
import { HostFilter } from "@/components/hosts/host-filter";
import { useIsCompactFormFactor } from "@/constants/layout";
import { useHosts, useHostRuntimeSnapshot } from "@/runtime/host-runtime";
import { useHostFeature } from "@/runtime/host-features";
import { useFetchQuery } from "@/data/query";
import { queryClient } from "@/data/query-client";
import { WikiEditor, type WikiNewPage } from "@/wiki/wiki-editor";
import { WikiDocument } from "@/wiki/wiki-document";
import { WikiTrash } from "@/wiki/wiki-trash";
import { WikiDraftList } from "@/wiki/wiki-draft-list";
import type { WikiDraftEntry } from "@/wiki/wiki-drafts";
import { confirmDialog } from "@/utils/confirm-dialog";
import { WikiBreadcrumbs, WikiRelated } from "@/wiki/wiki-navigation";

import { WikiLibrary } from "@/wiki/wiki-library";
import { WikiHome } from "@/wiki/wiki-home";
import { WikiHistory } from "@/wiki/wiki-history";
import { useWikiFavorites } from "@/wiki/wiki-preferences";

const EMPTY_PAGES: readonly WikiIndexEntry[] = [];

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
  const supportsWiki = useHostFeature(serverId, "optimizeWikiLifecycle");
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
  const [view, setView] = useState<"home" | "trash" | "drafts">("home");
  const [notice, setNotice] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{
    page?: WikiPage;
    initial?: WikiNewPage;
    draftId: string;
  } | null>(null);
  const favorites = useWikiFavorites(serverId);
  const enabled = active && online && supportsWiki && Boolean(client);
  const index = useFetchQuery({
    queryKey: ["optimize-wiki", serverId, "index", connectionEpoch],
    queryFn: async () => {
      if (!client) throw new Error("Optimize is disconnected.");
      const result = await client.indexWiki();
      if (!result.ok) throw new Error(result.error.message);
      return result.pages;
    },
    enabled,
    dataShape: "list",
    staleTimeMs: 5000,
    refetchInterval: 10000,
  });
  const pages = index.data ?? EMPTY_PAGES;
  const select = useCallback((id: string) => {
    setSelectedId(id);
    setView("home");
  }, []);
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
    refetchInterval: 10000,
  });
  const openEditor = useCallback(
    (page?: WikiPage, initial?: WikiNewPage) => {
      setEditor({
        page,
        initial,
        draftId: page && !initial ? page.id : globalThis.crypto.randomUUID(),
      });
      setView("home");
      setNotice(null);
      onEditingChange(true);
    },
    [onEditingChange],
  );
  const newPage = useCallback(
    (initial?: WikiNewPage) => openEditor(undefined, initial),
    [openEditor],
  );
  const newBlankPage = useCallback(() => newPage(), [newPage]);
  const closeEditor = useCallback(() => {
    setEditor(null);
    onEditingChange(false);
    void queryClient.invalidateQueries({ queryKey: ["optimize-wiki-drafts", serverId] });
  }, [onEditingChange, serverId]);
  const onSaved = useCallback(
    (saved: WikiPage) => {
      queryClient.setQueryData(
        ["optimize-wiki", serverId, "page", saved.id, connectionEpoch],
        saved,
      );
      void queryClient.invalidateQueries({ queryKey: ["optimize-wiki", serverId] });
      setSelectedId(saved.id);
      setView("home");
      setNotice("Page saved. Available to your team and the assistant.");
      closeEditor();
    },
    [serverId, connectionEpoch, closeEditor],
  );
  const changeSearch = useCallback((value: string) => {
    setSearch(value);
    setOffset(0);
  }, []);
  const back = useCallback(() => {
    setSelectedId(null);
    setView("home");
  }, []);
  const showTrash = useCallback(() => {
    setSelectedId(null);
    setView("trash");
    setNotice(null);
  }, []);
  const showDrafts = useCallback(() => {
    setSelectedId(null);
    setView("drafts");
    setNotice(null);
  }, []);
  const openDraft = useCallback(
    async (entry: WikiDraftEntry) => {
      if (!entry.draft) throw new Error("This draft could not be read. Its data has been kept.");
      let page = entry.draft.page;
      if (page && client && online) {
        const current = await client.readWiki(page.id);
        if (!current.ok) throw new Error(current.error.message);
        page = current.page;
      }
      setEditor({ page, draftId: entry.id });
      setView("home");
      onEditingChange(true);
    },
    [client, online, onEditingChange],
  );
  const archived = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["optimize-wiki", serverId] });
    setSelectedId(null);
    setView("home");
    setNotice("Page moved to Trash. You can restore it at any time.");
  }, [serverId]);
  const showDetails = Boolean(editor || selectedId || view !== "home");
  const library = useMemo(
    () => (
      <WikiLibrary
        compact={compact}
        pages={pages}
        results={list.data?.pages}
        error={list.error || index.error}
        enabled={enabled}
        editing={Boolean(editor)}
        selectedId={selectedId}
        onOpen={select}
        onHome={back}
        onTrash={showTrash}
        onDrafts={showDrafts}
        search={search}
        onSearch={changeSearch}
        offset={offset}
        onOffset={setOffset}
        nextOffset={list.data?.nextOffset ?? null}
        onNew={newBlankPage}
        favorites={favorites.ids}
      />
    ),
    [
      compact,
      pages,
      list.data,
      list.error,
      index.error,
      enabled,
      editor,
      selectedId,
      select,
      back,
      showTrash,
      showDrafts,
      search,
      changeSearch,
      offset,
      newBlankPage,
      favorites.ids,
    ],
  );
  const detail = useMemo(
    () => (
      <View style={styles.detail}>
        {editor && (
          <WikiEditor
            key={editor.draftId}
            draftId={editor.draftId}
            page={editor.page}
            initial={editor.initial}
            pages={pages}
            serverId={serverId}
            online={enabled}
            onSaved={onSaved}
            onCancel={closeEditor}
          />
        )}
        {!editor && selectedId && (
          <WikiReader
            key={selectedId}
            serverId={serverId}
            id={selectedId}
            client={client}
            enabled={enabled}
            connectionEpoch={connectionEpoch}
            compact={compact}
            onEdit={openEditor}
            onNew={newPage}
            favorite={favorites.ids.includes(selectedId)}
            onFavorite={favorites.toggle}
            onBack={back}
            onArchived={archived}
            pages={pages}
            onOpen={select}
          />
        )}
        {view === "trash" && !editor && (
          <WikiTrash
            serverId={serverId}
            client={client}
            online={enabled}
            onRestored={onSaved}
            onBack={back}
          />
        )}
        {view === "drafts" && !editor && (
          <WikiDraftList serverId={serverId} onOpen={openDraft} onBack={back} />
        )}
        {!showDetails && (
          <WikiHome
            pages={pages}
            favorites={favorites.ids}
            onOpen={select}
            onCreate={newPage}
            enabled={enabled}
          />
        )}
      </View>
    ),
    [
      editor,
      pages,
      serverId,
      enabled,
      onSaved,
      closeEditor,
      selectedId,
      client,
      connectionEpoch,
      compact,
      openEditor,
      newPage,
      favorites.ids,
      favorites.toggle,
      back,
      select,
      view,
      openDraft,
      archived,
      showDetails,
    ],
  );
  return (
    <View style={styles.content}>
      <WikiConnectionNotice online={online} supportsWiki={supportsWiki} error={index.error} />
      {notice && !editor && (
        <Text style={styles.notice} testID="wiki-save-notice">
          {notice}
        </Text>
      )}
      <WikiColumns compact={compact} showDetails={showDetails} library={library} detail={detail} />
    </View>
  );
}
function WikiColumns({
  compact,
  showDetails,
  library,
  detail,
}: {
  compact: boolean;
  showDetails: boolean;
  library: ReactNode;
  detail: ReactNode;
}) {
  return (
    <View style={[styles.columns, compact && styles.columnsCompact]}>
      {(!compact || !showDetails) && library}
      {(!compact || showDetails) && detail}
    </View>
  );
}

interface WikiReaderProps {
  pages: readonly WikiIndexEntry[];
  onOpen: (id: string) => void;
  serverId: string;
  id: string;
  client: DaemonClient | null;
  enabled: boolean;
  connectionEpoch: number;
  compact: boolean;
  onEdit: (page: WikiPage, initial?: WikiNewPage) => void;
  onNew: (initial?: WikiNewPage) => void;
  favorite: boolean;
  onFavorite: (id: string) => void;
  onBack: () => void;
  onArchived: () => void;
}
function WikiReader({
  pages,
  onOpen,
  serverId,
  id,
  client,
  enabled,
  connectionEpoch,
  compact,
  onEdit,
  onNew,
  favorite,
  onFavorite,
  onBack,
  onArchived,
}: WikiReaderProps) {
  const scroll = useRef<ScrollView>(null);
  const [history, setHistory] = useState(false);
  const [archiveState, setArchiveState] = useState<{ pending: boolean; error: string | null }>({
    pending: false,
    error: null,
  });
  const toggleHistory = useCallback(() => setHistory((value) => !value), []);
  const toggleFavorite = useCallback(() => onFavorite(id), [onFavorite, id]);
  const newChild = useCallback(() => onNew({ parentId: id }), [onNew, id]);
  const jump = useCallback((y: number) => scroll.current?.scrollTo({ y, animated: true }), []);
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
    refetchInterval: 10000,
  });
  const edit = useCallback(() => {
    if (query.data) onEdit(query.data);
  }, [query.data, onEdit]);
  const restore = useCallback(
    (initial: WikiNewPage) => {
      if (query.data) onEdit(query.data, initial);
    },
    [query.data, onEdit],
  );
  const archive = useCallback(async () => {
    if (!query.data || !client) return;
    if (
      !(await confirmDialog({
        title: `Move “${query.data.title}” to Trash?`,
        message:
          "The article and its history can be restored at any time. Subpages remain available at Wiki home. Links to this article will become available again when it is restored.",
        confirmLabel: "Move to Trash",
        destructive: true,
      }))
    )
      return;
    setArchiveState({ pending: true, error: null });
    try {
      const result = await client.archiveWiki({
        id,
        expectedRevision: query.data.revision,
        archived: true,
      });
      if (!result.ok) throw new Error(result.error.message);
      onArchived();
    } catch (error) {
      setArchiveState({
        pending: false,
        error: error instanceof Error ? error.message : "Could not move this article to Trash.",
      });
    }
  }, [query.data, client, id, onArchived]);
  const refetchPage = query.refetch;
  const retry = useCallback(() => {
    void refetchPage();
  }, [refetchPage]);
  return (
    <ScrollView ref={scroll} contentContainerStyle={styles.article}>
      <View style={styles.articleToolbar}>
        {compact ? (
          <Button size="sm" variant="ghost" leftIcon={ArrowLeft} onPress={onBack}>
            Pages
          </Button>
        ) : (
          <Text style={styles.eyebrow}>OPTIMIZE WIKI</Text>
        )}
        <View style={styles.actions}>
          <Button
            size="sm"
            variant="ghost"
            leftIcon={Trash2}
            onPress={archive}
            disabled={!enabled || !query.data || archiveState.pending}
            loading={archiveState.pending}
            accessibilityLabel="Move page to Trash"
            testID="wiki-trash-page"
          />
          <Button
            size="sm"
            variant={favorite ? "secondary" : "ghost"}
            leftIcon={Star}
            onPress={toggleFavorite}
            accessibilityLabel={favorite ? "Remove favorite" : "Add favorite"}
          />
          <Button
            size="sm"
            variant={history ? "secondary" : "ghost"}
            leftIcon={History}
            onPress={toggleHistory}
            disabled={!enabled || !query.data}
            accessibilityLabel="Version history"
            testID="wiki-open-history"
          />
          <Button size="sm" variant="ghost" leftIcon={Plus} onPress={newChild} disabled={!enabled}>
            Subpage
          </Button>
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
      </View>
      {archiveState.error && <Text style={styles.error}>{archiveState.error}</Text>}
      <WikiBreadcrumbs id={id} pages={pages} onOpen={onOpen} onHome={onBack} />
      {history && query.data && client && enabled && (
        <WikiHistory
          page={query.data}
          pages={pages}
          client={client}
          serverId={serverId}
          onRestore={restore}
          onClose={toggleHistory}
          onOpen={onOpen}
        />
      )}
      <WikiArticle
        page={query.data}
        error={query.error}
        retry={retry}
        pages={pages}
        onOpen={onOpen}
        onJump={jump}
      />
      {query.data && <WikiRelated id={id} pages={pages} onOpen={onOpen} />}
    </ScrollView>
  );
}
function WikiArticle({
  pages,
  onOpen,
  onJump,
  page,
  error,
  retry,
}: {
  pages: readonly WikiIndexEntry[];
  onOpen: (id: string) => void;
  onJump: (y: number) => void;
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
      <WikiDocument
        body={page.body || "This page is empty. Choose Edit page to add context."}
        pages={pages}
        onOpen={onOpen}
        onJump={onJump}
      />
    </>
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
  searchRow: { flexDirection: "row", flexShrink: 0 },
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

function WikiConnectionNotice({
  online,
  supportsWiki,
  error,
}: {
  online: boolean;
  supportsWiki: boolean;
  error: Error | null;
}) {
  if (!online)
    return <Text style={styles.notice}>Reconnecting to Optimize… Your draft is kept.</Text>;
  if (!supportsWiki)
    return (
      <Text style={styles.notice}>
        Update this Optimize host to use the Wiki with drafts and recoverable Trash.
      </Text>
    );
  if (error) return <Text style={styles.notice}>{error.message}</Text>;
  return null;
}
