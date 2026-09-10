import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { FilePenLine, ArrowLeft } from "lucide-react-native";
import { StyleSheet } from "react-native-unistyles";
import { Button } from "@/components/ui/button";
import { useFetchQuery } from "@/data/query";
import { queryClient } from "@/data/query-client";
import { confirmDialog } from "@/utils/confirm-dialog";
import { parseWikiDrafts, wikiDraftPrefix, wikiDraftKey, type WikiDraftEntry } from "./wiki-drafts";

export function WikiDraftList({
  serverId,
  onOpen,
  onBack,
}: {
  serverId: string;
  onOpen: (entry: WikiDraftEntry) => Promise<void>;
  onBack: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const drafts = useFetchQuery({
    queryKey: ["optimize-wiki-drafts", serverId],
    queryFn: async () => {
      const keys = (await AsyncStorage.getAllKeys()).filter((key) =>
        key.startsWith(wikiDraftPrefix(serverId)),
      );
      return parseWikiDrafts(serverId, await AsyncStorage.multiGet(keys));
    },
    enabled: true,
    dataShape: "list",
    staleTimeMs: 0,
  });
  const open = useCallback(
    async (entry: WikiDraftEntry) => {
      setPending(entry.id);
      setError(null);
      try {
        await onOpen(entry);
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "Could not open this draft.");
      } finally {
        setPending(null);
      }
    },
    [onOpen],
  );
  const discard = useCallback(
    async (entry: WikiDraftEntry) => {
      if (
        !(await confirmDialog({
          title: "Discard this draft?",
          message:
            "This removes unpublished changes from this Mac. Published articles remain available.",
          confirmLabel: "Discard draft",
          destructive: true,
        }))
      )
        return;
      setPending(entry.id);
      setError(null);
      try {
        await AsyncStorage.removeItem(wikiDraftKey(serverId, entry.id));
        await queryClient.invalidateQueries({ queryKey: ["optimize-wiki-drafts", serverId] });
      } catch {
        setError("Could not discard this draft. Try again.");
      } finally {
        setPending(null);
      }
    },
    [serverId],
  );
  return (
    <ScrollView contentContainerStyle={styles.content} testID="wiki-drafts">
      <Button size="sm" variant="ghost" leftIcon={ArrowLeft} onPress={onBack} style={styles.back}>
        Wiki home
      </Button>
      <Text style={styles.title}>Your drafts</Text>
      <Text style={styles.muted}>
        Unpublished articles and changes saved on this Mac. Open a draft to keep writing or publish
        it for your team.
      </Text>
      {(error || drafts.error) && (
        <Text style={styles.error}>{error || drafts.error?.message}</Text>
      )}
      {!drafts.data && !drafts.error && <Text style={styles.muted}>Loading drafts…</Text>}
      {drafts.data?.length === 0 && (
        <Text style={styles.muted}>No drafts. Choose New page to start writing.</Text>
      )}
      {drafts.data?.map((entry) => (
        <WikiDraftRow
          key={entry.id}
          entry={entry}
          pending={pending}
          onOpen={open}
          onDiscard={discard}
        />
      ))}
    </ScrollView>
  );
}
function WikiDraftRow({
  entry,
  pending,
  onOpen,
  onDiscard,
}: {
  entry: WikiDraftEntry;
  pending: string | null;
  onOpen: (entry: WikiDraftEntry) => Promise<void>;
  onDiscard: (entry: WikiDraftEntry) => Promise<void>;
}) {
  const open = useCallback(() => {
    void onOpen(entry);
  }, [entry, onOpen]);
  const discard = useCallback(() => {
    void onDiscard(entry);
  }, [entry, onDiscard]);
  return (
    <View style={styles.row}>
      <View style={styles.heading}>
        <Text style={styles.name}>{entry.draft?.title.trim() || "Untitled draft"}</Text>
        <Text style={styles.muted}>
          {entry.draft
            ? entry.draft.body.slice(0, 120).replace(/\s+/g, " ")
            : "This saved draft could not be read. Its data is still on this Mac."}
        </Text>
      </View>
      <Button size="sm" variant="ghost" onPress={discard} disabled={Boolean(pending)}>
        Discard
      </Button>
      <Button
        size="sm"
        variant="secondary"
        leftIcon={FilePenLine}
        onPress={open}
        disabled={!entry.draft || Boolean(pending)}
        loading={pending === entry.id}
        testID={`wiki-resume-draft-${entry.id}`}
      >
        Continue writing
      </Button>
    </View>
  );
}
const styles = StyleSheet.create((theme) => ({
  content: { padding: 36, gap: 22, width: "100%", maxWidth: 960, alignSelf: "center" },
  back: { alignSelf: "flex-start" },
  title: { color: theme.colors.foreground, fontSize: 30, fontWeight: "600" },
  muted: { color: theme.colors.foregroundMuted, fontSize: 13, lineHeight: 21 },
  error: { color: theme.colors.destructive, fontSize: 13 },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  heading: { flex: 1, minWidth: 160, gap: 6 },
  name: { color: theme.colors.foreground, fontWeight: "500", fontSize: 16 },
}));
