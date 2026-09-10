import { ChoiceButton } from "@/components/ui/choice-button";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import Svg, { Circle, G, Line, Text as SvgText } from "react-native-svg";
import { StyleSheet } from "react-native-unistyles";
import type { WikiIndexEntry } from "@getpaseo/protocol/optimize-wiki";
import { wikiRelations } from "@getpaseo/protocol/wiki-links";
import { SearchField } from "@/components/ui/search-field";
import { Button } from "@/components/ui/button";

export function WikiGraph({
  pages,
  onOpen,
}: {
  pages: readonly WikiIndexEntry[];
  onOpen: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [zoom, setZoom] = useState(1);
  const links = useMemo(() => wikiRelations(pages), [pages]);
  const matching = useMemo(() => {
    if (!search.trim()) return pages;
    const ids = new Set(
      pages
        .filter((page) =>
          page.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
        )
        .map((page) => page.id),
    );
    const neighbors = new Set(ids);
    for (const link of links)
      if (ids.has(link.source) || ids.has(link.target)) {
        neighbors.add(link.source);
        neighbors.add(link.target);
      }
    return pages.filter((page) => neighbors.has(page.id));
  }, [pages, links, search]);
  const visible = matching.slice(0, 80);
  const nodes = visible.map((page, index) => {
    const angle = index * 2.399963;
    const radius = Math.sqrt(index / Math.max(visible.length, 1)) * 190;
    return { ...page, x: 400 + Math.cos(angle) * radius * 1.65, y: 250 + Math.sin(angle) * radius };
  });
  const positions = new Map(nodes.map((node) => [node.id, node]));
  const zoomOut = useCallback(() => setZoom((value) => Math.max(0.75, value - 0.25)), []);
  const zoomIn = useCallback(() => setZoom((value) => Math.min(2, value + 0.25)), []);
  return (
    <ScrollView contentContainerStyle={styles.content} testID="wiki-graph">
      <Text style={styles.title}>Knowledge graph</Text>
      <Text style={styles.muted}>
        Articles and their connections. Select an article to open it.
      </Text>
      <View style={styles.toolbar}>
        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Find an article and its neighbors…"
          clearAccessibilityLabel="Clear graph search"
        />
        <Button size="sm" variant="ghost" onPress={zoomOut}>
          −
        </Button>
        <Button size="sm" variant="ghost" onPress={zoomIn}>
          +
        </Button>
      </View>
      <View style={styles.canvas}>
        <Svg
          width="100%"
          height={480}
          viewBox={`${400 - 400 / zoom} ${250 - 250 / zoom} ${800 / zoom} ${500 / zoom}`}
        >
          {links.map((link) => {
            const a = positions.get(link.source);
            const b = positions.get(link.target);
            return a && b ? (
              <Line
                key={`${link.kind}-${link.source}-${link.target}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={link.kind === "parent" ? "#F72626" : "#777777"}
                strokeWidth={1.2}
                opacity={0.45}
                strokeDasharray={link.kind === "parent" ? "4 4" : undefined}
              />
            ) : null;
          })}
          {nodes.map((node) => (
            <GraphNode
              key={node.id}
              id={node.id}
              title={node.title}
              x={node.x}
              y={node.y}
              onOpen={onOpen}
            />
          ))}
        </Svg>
      </View>
      <Text style={styles.muted}>Red dashed lines: subpages · Gray lines: article links</Text>
      {matching.length > 80 && (
        <Text style={styles.muted}>
          Showing 80 of {matching.length} articles. Search to explore a smaller group.
        </Text>
      )}
      {!nodes.length && <Text style={styles.muted}>No articles match this view.</Text>}
      <View style={styles.articles}>
        {visible.map((page) => (
          <ChoiceButton key={page.id} variant="ghost" size="sm" value={page.id} onSelect={onOpen}>
            {page.title}
          </ChoiceButton>
        ))}
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create((theme) => ({
  content: { padding: 28, gap: 16 },
  title: { fontSize: 27, fontWeight: "600", color: theme.colors.foreground },
  muted: { color: theme.colors.foregroundMuted, fontSize: 13, lineHeight: 20 },
  toolbar: { flexDirection: "row", gap: 8 },
  canvas: { backgroundColor: "#252525", borderRadius: 18, overflow: "hidden" },
  articles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
}));

function GraphNode({
  id,
  title,
  x,
  y,
  onOpen,
}: {
  id: string;
  title: string;
  x: number;
  y: number;
  onOpen: (id: string) => void;
}) {
  const onPress = useCallback(() => onOpen(id), [id, onOpen]);
  return (
    <G onPress={onPress} accessibilityLabel={`Open ${title}`}>
      <Circle cx={x} cy={y} r={7} fill="#F72626" />
      <SvgText x={x} y={y + 23} fill="#EEEEEE" fontSize={11} textAnchor="middle">
        {title.length > 25 ? title.slice(0, 24) + "…" : title}
      </SvgText>
    </G>
  );
}
