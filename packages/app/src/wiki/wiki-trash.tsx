import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { ArrowLeft, RotateCcw } from "lucide-react-native";
import { StyleSheet } from "react-native-unistyles";
import type { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import type { WikiPage, WikiPageSummary } from "@getpaseo/protocol/optimize-wiki";
import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/ui/search-field";
import { useFetchQuery } from "@/data/query";
import { wikiExcerpt } from "./wiki-tree";

export function WikiTrash({
  serverId,
  client,
  online,
  onRestored,
  onBack,
}: {
  serverId: string;
  client: DaemonClient | null;
  online: boolean;
  onRestored: (page: WikiPage) => void;
  onBack: () => void;
}) {
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const list = useFetchQuery({
    queryKey: ["optimize-wiki", serverId, "trash", search, offset],
    queryFn: async () => {
      if (!client) throw new Error("Reconnect to Optimize to open Trash.");
      const result = await client.trashWiki({ query: search, offset });
      if (!result.ok) throw new Error(result.error.message);
      return result;
    },
    enabled: online,
    dataShape: "list",
    staleTimeMs: 0,
    refetchInterval: 10000,
  });
  const restore = useCallback(
    async (page: WikiPageSummary) => {
      if (!client) return;
      setPending(page.id);
      setError(null);
      try {
        const result = await client.archiveWiki({
          id: page.id,
          expectedRevision: page.revision,
          archived: false,
        });
        if (!result.ok) throw new Error(result.error.message);
        onRestored(result.page);
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "Could not restore the page.");
      } finally {
        setPending(null);
      }
    },
    [client, onRestored],
  );
  const changeSearch = useCallback((value: string) => {
    setSearch(value);
    setOffset(0);
  }, []);
  const previous = useCallback(() => setOffset((value) => Math.max(0, value - 50)), []);
  const next = useCallback(() => {
    if (list.data?.nextOffset != null) setOffset(list.data.nextOffset);
  }, [list.data?.nextOffset]);
  return (
    <ScrollView contentContainerStyle={styles.content} testID="wiki-trash">
      <Button size="sm" variant="ghost" leftIcon={ArrowLeft} onPress={onBack} style={styles.back}>
        Wiki home
      </Button>
      <Text style={styles.title}>Trash</Text>
      <Text style={styles.muted}>
        Deleted articles are kept here with their version history. They are excluded from search and
        the assistant’s current knowledge. Restore an article to make it available again.
      </Text>
      <View style={styles.search}>
        <SearchField
          value={search}
          onChangeText={changeSearch}
          placeholder="Search deleted articles…"
          clearAccessibilityLabel="Clear Trash search"
        />
      </View>
      {(error || list.error) && <Text style={styles.error}>{error || list.error?.message}</Text>}
      {!online && <Text style={styles.muted}>Reconnect to Optimize to restore articles.</Text>}
      {!list.data && !list.error && online && <Text style={styles.muted}>Loading Trash…</Text>}
      {list.data?.pages.length === 0 && (
        <Text style={styles.muted}>
          {search ? "No matching articles in Trash." : "Trash is empty."}
        </Text>
      )}
      {list.data?.pages.map((page) => (
        <TrashRow key={page.id} page={page} pending={pending} online={online} onRestore={restore} />
      ))}
      <View style={styles.pagination}>
        {offset > 0 && (
          <Button size="sm" variant="ghost" onPress={previous}>
            Previous
          </Button>
        )}
        {list.data?.nextOffset != null && (
          <Button size="sm" variant="ghost" onPress={next}>
            Next
          </Button>
        )}
      </View>
    </ScrollView>
  );
}
function TrashRow({
  page,
  pending,
  online,
  onRestore,
}: {
  page: WikiPageSummary;
  pending: string | null;
  online: boolean;
  onRestore: (page: WikiPageSummary) => Promise<void>;
}) {
  const restore = useCallback(() => {
    void onRestore(page);
  }, [page, onRestore]);
  return (
    <View style={styles.row} testID={`wiki-trashed-page-${page.id}`}>
      <View style={styles.heading}>
        <Text style={styles.name}>{page.title}</Text>
        <Text style={styles.muted}>{wikiExcerpt(page.excerpt)}</Text>
        <Text style={styles.date}>
          Moved to Trash {new Date(page.trashedAt ?? page.updatedAt).toLocaleString()}
        </Text>
      </View>
      <Button
        size="sm"
        variant="secondary"
        leftIcon={RotateCcw}
        onPress={restore}
        disabled={!online || Boolean(pending)}
        loading={pending === page.id}
        testID={`wiki-restore-page-${page.id}`}
      >
        Restore page
      </Button>
    </View>
  );
}
const styles = StyleSheet.create((theme) => ({
  content: { padding: 36, gap: 22, width: "100%", maxWidth: 960, alignSelf: "center" },
  back: { alignSelf: "flex-start" },
  title: { color: theme.colors.foreground, fontSize: 30, fontWeight: "600" },
  search: { flexDirection: "row", maxWidth: 480 },
  muted: { color: theme.colors.foregroundMuted, fontSize: 13, lineHeight: 21 },
  error: { color: theme.colors.destructive, fontSize: 13 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  heading: { flex: 1, minWidth: 0, gap: 7 },
  name: { color: theme.colors.foreground, fontWeight: "500", fontSize: 17 },
  date: { color: theme.colors.foregroundMuted, fontSize: 11 },
  pagination: { flexDirection: "row", gap: 8 },
}));
