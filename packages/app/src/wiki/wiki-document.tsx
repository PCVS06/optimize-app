import { useCallback, useMemo, useRef } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { WikiIndexEntry } from "@getpaseo/protocol/optimize-wiki";
import { mapWikiLinks, resolveWikiLink } from "@getpaseo/protocol/wiki-links";
import { MarkdownRenderer } from "@/components/markdown/renderer";
import { ChoiceButton } from "@/components/ui/choice-button";
import { wikiSections } from "./wiki-structure";

export function WikiDocument({
  body,
  pages,
  onOpen,
  onJump,
}: {
  body: string;
  pages: readonly WikiIndexEntry[];
  onOpen: (id: string) => void;
  onJump?: (y: number) => void;
}) {
  const documentY = useRef(0);
  const positions = useRef(new Map<number, number>());
  const sections = useMemo(() => wikiSections(body), [body]);
  const headings = sections.filter((section) => section.heading);
  const rendered = useMemo(
    () =>
      sections.map((section) => ({
        ...section,
        markdown: mapWikiLinks({
          body: section.markdown,
          replace: (target, label) => {
            const page = resolveWikiLink({ target, pages });
            const escaped = label.replace(/[[\]\\]/g, "\\$&");
            return page ? `[${escaped}](#/wiki/${page.id})` : `${escaped} *(unresolved link)*`;
          },
        }),
      })),
    [sections, pages],
  );
  const onLinkPress = useCallback(
    (url: string) => {
      if (!url.startsWith("#/wiki/")) return true;
      const id = url.slice("#/wiki/".length);
      if (pages.some((page) => page.id === id)) onOpen(id);
      return false;
    },
    [pages, onOpen],
  );
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    documentY.current = event.nativeEvent.layout.y;
  }, []);
  const measureSection = useCallback((index: number, y: number) => {
    positions.current.set(index, y);
  }, []);
  const jump = useCallback(
    (index: string) => onJump?.(documentY.current + (positions.current.get(Number(index)) ?? 0)),
    [onJump],
  );
  return (
    <View testID="wiki-article-body" onLayout={onLayout}>
      {headings.length > 0 && onJump && (
        <View style={styles.contents} testID="wiki-table-of-contents">
          <Text style={styles.label}>ON THIS PAGE</Text>
          {headings.map((section) => (
            <View
              key={section.index}
              style={[styles.item, { paddingLeft: Math.max(0, section.level - 1) * 12 }]}
            >
              <ChoiceButton size="sm" variant="ghost" value={String(section.index)} onSelect={jump}>
                {section.heading}
              </ChoiceButton>
            </View>
          ))}
        </View>
      )}
      {rendered.map((section) => (
        <WikiSection
          key={section.index}
          index={section.index}
          markdown={section.markdown}
          onMeasure={measureSection}
          onLinkPress={onLinkPress}
        />
      ))}
    </View>
  );
}
function WikiSection({
  index,
  markdown,
  onMeasure,
  onLinkPress,
}: {
  index: number;
  markdown: string;
  onMeasure: (index: number, y: number) => void;
  onLinkPress: (url: string) => boolean;
}) {
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => onMeasure(index, event.nativeEvent.layout.y),
    [index, onMeasure],
  );
  return (
    <View onLayout={onLayout}>
      <MarkdownRenderer text={markdown} enableHtmlish={false} onLinkPress={onLinkPress} />
    </View>
  );
}
const styles = StyleSheet.create((theme) => ({
  contents: {
    padding: 18,
    marginVertical: 20,
    gap: 6,
    borderRadius: 14,
    backgroundColor: theme.colors.surface1,
  },
  label: { color: theme.colors.foregroundMuted, fontSize: 11, letterSpacing: 1.3 },
  item: { alignItems: "flex-start" },
}));
