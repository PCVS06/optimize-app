import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import type { WikiIndexEntry, WikiPage } from "@getpaseo/protocol/optimize-wiki";
import { useFetchQuery } from "@/data/query";
import { Button } from "@/components/ui/button";
import { ChoiceButton } from "@/components/ui/choice-button";
import { WikiDocument } from "./wiki-document";
import type { WikiNewPage } from "./wiki-editor";

export function WikiHistory({
  page,
  pages,
  client,
  serverId,
  onRestore,
  onClose,
  onOpen,
}: {
  page: WikiPage;
  pages: readonly WikiIndexEntry[];
  client: DaemonClient;
  serverId: string;
  onRestore: (initial: WikiNewPage) => void;
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const history = useFetchQuery({
    queryKey: ["optimize-wiki", serverId, "history", page.id, page.revision, offset],
    queryFn: async () => {
      const result = await client.historyWiki(page.id, offset);
      if (!result.ok) throw new Error(result.error.message);
      return result;
    },
    enabled: true,
    dataShape: "list",
  });
  const revision = useFetchQuery({
    queryKey: ["optimize-wiki", serverId, "revision", page.id, selected],
    queryFn: async () => {
      if (!selected) throw new Error("Select a revision.");
      const result = await client.revisionWiki(page.id, selected);
      if (!result.ok) throw new Error(result.error.message);
      return result.page;
    },
    enabled: Boolean(selected),
    dataShape: "value",
  });
  const restore = useCallback(() => {
    if (revision.data)
      onRestore({
        title: revision.data.title,
        body: revision.data.body,
        parentId: revision.data.parentId ?? null,
      });
  }, [revision.data, onRestore]);
  const previous = useCallback(() => setOffset((value) => Math.max(0, value - 50)), []);
  const next = useCallback(() => {
    if (history.data?.nextOffset != null) setOffset(history.data.nextOffset);
  }, [history.data?.nextOffset]);
  return (
    <View style={styles.history} testID="wiki-history">
      <View style={styles.header}>
        <View style={styles.heading}>
          <Text style={styles.title}>Version history</Text>
          <Text style={styles.muted}>
            Restore a previous version as a draft, then review and publish it.
          </Text>
        </View>
        <Button size="sm" variant="ghost" onPress={onClose}>
          Close history
        </Button>
      </View>
      <View style={styles.current}>
        <Text style={styles.label}>CURRENT VERSION</Text>
        <Text style={styles.muted}>{new Date(page.updatedAt).toLocaleString()}</Text>
      </View>
      {history.error && <Text style={styles.error}>{history.error.message}</Text>}
      {!history.data && !history.error && <Text style={styles.muted}>Loading versions…</Text>}
      {history.data?.revisions.length === 0 && (
        <Text style={styles.muted}>The first published version has no earlier revisions.</Text>
      )}
      {history.data?.revisions.map((entry) => (
        <ChoiceButton
          key={entry.revision}
          size="sm"
          variant={entry.revision === selected ? "secondary" : "ghost"}
          value={entry.revision}
          onSelect={setSelected}
          testID={`wiki-revision-${entry.revision}`}
        >
          {new Date(entry.updatedAt).toLocaleString()} · {entry.title}
        </ChoiceButton>
      ))}
      <View style={styles.actions}>
        {offset > 0 && (
          <Button size="sm" variant="ghost" onPress={previous}>
            Newer versions
          </Button>
        )}
        {history.data?.nextOffset != null && (
          <Button size="sm" variant="ghost" onPress={next}>
            Older versions
          </Button>
        )}
      </View>
      {revision.error && <Text style={styles.error}>{revision.error.message}</Text>}
      {revision.data && (
        <View style={styles.preview}>
          <View style={styles.header}>
            <Text style={styles.title}>{revision.data.title}</Text>
            <Button size="sm" onPress={restore} testID="wiki-restore-revision">
              Restore as draft
            </Button>
          </View>
          <WikiDocument body={revision.data.body} pages={pages} onOpen={onOpen} />
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create((theme) => ({
  history: {
    padding: 24,
    gap: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    marginVertical: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
    flexWrap: "wrap",
  },
  heading: { gap: 6, flex: 1 },
  title: { color: theme.colors.foreground, fontSize: 16, fontWeight: "600" },
  muted: { color: theme.colors.foregroundMuted, fontSize: 12, lineHeight: 20 },
  label: { color: theme.colors.foregroundMuted, fontSize: 10, letterSpacing: 1 },
  current: {
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  preview: { paddingTop: 20, gap: 16, borderTopWidth: 1, borderTopColor: theme.colors.border },
  error: { color: theme.colors.destructive, fontSize: 12 },
  actions: { flexDirection: "row", gap: 8 },
}));
