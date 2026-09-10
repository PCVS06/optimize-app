import { useCallback, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import {
  BookOpen,
  FileText,
  Plus,
  Home,
  Network,
  ChevronDown,
  ChevronRight,
  Star,
} from "lucide-react-native";
import type { WikiIndexEntry, WikiPageSummary } from "@getpaseo/protocol/optimize-wiki";
import { Button } from "@/components/ui/button";
import { ChoiceButton } from "@/components/ui/choice-button";
import { SearchField } from "@/components/ui/search-field";
import { wikiTreeRows, wikiExcerpt } from "./wiki-tree";

export function WikiLibrary({
  pages,
  results,
  error,
  favorites,
  selectedId,
  search,
  onSearch,
  onOpen,
  onHome,
  onGraph,
  onNew,
  editing,
  enabled,
  compact,
  nextOffset,
  offset,
  onOffset,
}: {
  pages: readonly WikiIndexEntry[];
  results?: WikiPageSummary[];
  error: Error | null;
  favorites: readonly string[];
  selectedId: string | null;
  search: string;
  onSearch: (value: string) => void;
  onOpen: (id: string) => void;
  onHome: () => void;
  onGraph: () => void;
  onNew: () => void;
  editing: boolean;
  enabled: boolean;
  compact: boolean;
  nextOffset: number | null;
  offset: number;
  onOffset: (offset: number) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const rows = useMemo(
    () => wikiTreeRows(pages, expanded, selectedId),
    [pages, expanded, selectedId],
  );
  const toggle = useCallback(
    (id: string) =>
      setExpanded((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );
  const previous = useCallback(() => onOffset(Math.max(0, offset - 50)), [offset, onOffset]);
  const next = useCallback(() => {
    if (nextOffset !== null) onOffset(nextOffset);
  }, [nextOffset, onOffset]);
  const pinned = pages.filter((page) => favorites.includes(page.id));
  return (
    <View style={[styles.library, compact && styles.compact]}>
      <View style={styles.heading}>
        <Text style={styles.brand}>Optimize Wiki</Text>
        <Button
          size="sm"
          variant="ghost"
          leftIcon={Plus}
          onPress={onNew}
          disabled={!enabled || editing}
          accessibilityLabel="New Wiki page"
          testID="wiki-new-page"
        />
      </View>
      <View style={styles.search} testID="wiki-search-row">
        <SearchField
          value={search}
          onChangeText={onSearch}
          placeholder="Search all articles…"
          clearAccessibilityLabel="Clear Wiki search"
          testID="wiki-search"
        />
      </View>
      <Button
        size="sm"
        variant="ghost"
        leftIcon={Home}
        onPress={onHome}
        disabled={editing}
        style={styles.align}
        testID="wiki-home-navigation"
      >
        Wiki home
      </Button>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
        {error && <Text style={styles.error}>{error.message}</Text>}
        {search.trim() ? (
          <>
            <Text style={styles.label}>SEARCH RESULTS</Text>
            <SearchResults
              results={results}
              selectedId={selectedId}
              editing={editing}
              onOpen={onOpen}
            />
            <View style={styles.pagination}>
              {offset > 0 && (
                <Button size="sm" variant="ghost" onPress={previous}>
                  Previous
                </Button>
              )}
              {nextOffset !== null && (
                <Button size="sm" variant="ghost" onPress={next}>
                  Next
                </Button>
              )}
            </View>
          </>
        ) : (
          <>
            {pinned.length > 0 && (
              <View style={styles.group}>
                <Text style={styles.label}>FAVORITES</Text>
                {pinned.map((page) => (
                  <ArticleButton
                    key={page.id}
                    page={page}
                    selected={page.id === selectedId}
                    disabled={editing}
                    onOpen={onOpen}
                    favorite
                  />
                ))}
              </View>
            )}
            <View style={styles.group} testID="wiki-page-tree">
              <Text style={styles.label}>PAGES</Text>
              {rows.map((row) => (
                <TreeRow
                  key={row.page.id}
                  row={row}
                  selected={row.page.id === selectedId}
                  disabled={editing}
                  onOpen={onOpen}
                  onToggle={toggle}
                />
              ))}
              {pages.length === 0 && (
                <Text style={styles.muted}>
                  Create your first article or start with a template.
                </Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Button
          size="sm"
          variant="ghost"
          leftIcon={Network}
          onPress={onGraph}
          disabled={editing || !enabled}
          testID="wiki-open-graph"
          style={styles.align}
        >
          Knowledge graph
        </Button>
        <Text style={styles.caption}>{pages.length} articles · Shared knowledge</Text>
      </View>
    </View>
  );
}
function SearchResults({
  results,
  selectedId,
  editing,
  onOpen,
}: {
  results?: WikiPageSummary[];
  selectedId: string | null;
  editing: boolean;
  onOpen: (id: string) => void;
}) {
  if (!results) return <Text style={styles.muted}>Searching…</Text>;
  if (!results.length)
    return <Text style={styles.muted}>No matching pages. Try different words.</Text>;
  return (
    <>
      {results.map((page) => (
        <View key={page.id} style={styles.result}>
          <ArticleButton
            page={page}
            selected={page.id === selectedId}
            disabled={editing}
            onOpen={onOpen}
          />
          <Text numberOfLines={2} style={styles.excerpt}>
            {wikiExcerpt(page.excerpt)}
          </Text>
        </View>
      ))}
    </>
  );
}
function ArticleButton({
  page,
  selected,
  disabled,
  onOpen,
  favorite = false,
}: {
  page: { id: string; title: string };
  selected: boolean;
  disabled: boolean;
  onOpen: (id: string) => void;
  favorite?: boolean;
}) {
  return (
    <ChoiceButton
      value={page.id}
      onSelect={onOpen}
      variant={selected ? "secondary" : "ghost"}
      size="sm"
      leftIcon={favorite ? Star : FileText}
      disabled={disabled}
      style={styles.articleButton}
      numberOfLines={1}
      textStyle={styles.singleLine}
      testID={`${favorite ? "wiki-favorite" : "wiki-page"}-${page.id}`}
    >
      {page.title}
    </ChoiceButton>
  );
}
function TreeRow({
  row,
  selected,
  disabled,
  onOpen,
  onToggle,
}: {
  row: ReturnType<typeof wikiTreeRows>[number];
  selected: boolean;
  disabled: boolean;
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const toggle = useCallback(() => onToggle(row.page.id), [onToggle, row.page.id]);
  return (
    <View style={[styles.treeRow, { paddingLeft: Math.min(row.depth, 8) * 14 }]}>
      {row.hasChildren ? (
        <Button
          size="sm"
          variant="ghost"
          leftIcon={row.expanded ? ChevronDown : ChevronRight}
          onPress={toggle}
          accessibilityLabel={`${row.expanded ? "Collapse" : "Expand"} ${row.page.title}`}
        />
      ) : (
        <View style={styles.spacer} />
      )}
      <ChoiceButton
        value={row.page.id}
        onSelect={onOpen}
        size="sm"
        variant={selected ? "secondary" : "ghost"}
        leftIcon={row.hasChildren ? BookOpen : FileText}
        disabled={disabled}
        style={styles.articleButton}
        numberOfLines={1}
        textStyle={styles.singleLine}
        testID={`wiki-page-${row.page.id}`}
      >
        {row.page.title}
      </ChoiceButton>
    </View>
  );
}
const styles = StyleSheet.create((theme) => ({
  library: {
    width: 264,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    backgroundColor: theme.colors.surface1,
    paddingTop: 22,
    paddingHorizontal: 14,
    gap: 16,
  },
  compact: { width: "100%", flex: 1, borderRightWidth: 0 },
  heading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingLeft: 8,
  },
  brand: { fontSize: 15, fontWeight: "600", color: theme.colors.foreground },
  search: { flexDirection: "row", flexShrink: 0 },
  scroll: { flex: 1 },
  list: { gap: 24, paddingBottom: 20 },
  group: { gap: 4 },
  label: {
    color: theme.colors.foregroundMuted,
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  treeRow: { flexDirection: "row", alignItems: "center", minHeight: 36 },
  spacer: { width: 16 },
  singleLine: { flexShrink: 1 },
  articleButton: { flex: 1, minWidth: 0, justifyContent: "flex-start" },
  align: { justifyContent: "flex-start" },
  result: { gap: 4 },
  excerpt: {
    color: theme.colors.foregroundMuted,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  muted: {
    color: theme.colors.foregroundMuted,
    fontSize: 12,
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  caption: { color: theme.colors.foregroundMuted, fontSize: 11, paddingHorizontal: 10 },
  footer: { paddingVertical: 16, gap: 10, borderTopWidth: 1, borderTopColor: theme.colors.border },
  pagination: { flexDirection: "row", gap: 8 },
  error: { color: theme.colors.destructive, fontSize: 12 },
}));
