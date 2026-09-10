import { useCallback } from "react";
import { ScrollView, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { ArrowUpRight, BookOpen, FileText, Plus } from "lucide-react-native";
import type { WikiIndexEntry } from "@getpaseo/protocol/optimize-wiki";
import { Button } from "@/components/ui/button";
import { ChoiceButton } from "@/components/ui/choice-button";
import type { WikiNewPage } from "./wiki-editor";

const templates = [
  { id: "article", title: "Article", hint: "Capture and explain a topic", body: "" },
  {
    id: "overview",
    title: "Knowledge hub",
    hint: "Organize a subject and its subpages",
    body: "## Overview\n\nIntroduce this knowledge area.\n\n## Start here\n\nLink the most useful articles for your team.\n",
  },
  {
    id: "process",
    title: "Process guide",
    hint: "Make a workflow repeatable",
    body: "## Purpose\n\nDescribe when to use this process.\n\n## Before you start\n\n- [ ] List the prerequisites\n\n## Steps\n\n1. Describe the first step\n2. Describe the next step\n\n## Exceptions\n\nExplain what to do when the usual steps do not apply.\n\n## Related knowledge\n\nLink the relevant articles.\n",
  },
  {
    id: "product",
    title: "Product reference",
    hint: "Keep product facts in one place",
    body: "## Overview\n\nDescribe the product using verified information.\n\n## Specifications\n\n| Property | Detail |\n| --- | --- |\n| Add a property | Add the verified value |\n\n## Compatibility\n\nDocument supported use cases and limitations.\n\n## Care and support\n\nLink approved care and support guidance.\n\n## Sources\n\nRecord where the information was verified.\n",
  },
];
export function WikiHome({
  pages,
  favorites,
  onOpen,
  onCreate,
  enabled,
}: {
  pages: readonly WikiIndexEntry[];
  favorites: readonly string[];
  onOpen: (id: string) => void;
  onCreate: (initial?: WikiNewPage) => void;
  enabled: boolean;
}) {
  const roots = pages.filter((page) => !page.parentId);
  const recent = [...pages].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
  const pinned = pages.filter((page) => favorites.includes(page.id));
  const create = useCallback(() => onCreate(), [onCreate]);
  const template = useCallback(
    (id: string) => onCreate({ body: templates.find((entry) => entry.id === id)?.body ?? "" }),
    [onCreate],
  );
  return (
    <ScrollView contentContainerStyle={styles.home}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>THE OPTIMIZE KNOWLEDGE BASE</Text>
        <Text style={styles.title}>Knowledge that{String.fromCharCode(10)}moves us forward.</Text>
        <Text style={styles.intro}>
          One place for our products, our processes, and what we learn along the way.
        </Text>
        <View style={styles.heroActions}>
          <Button
            size="sm"
            leftIcon={Plus}
            onPress={create}
            disabled={!enabled}
            testID="wiki-create-first"
          >
            Create an article
          </Button>
          <Text style={styles.meta}>
            {pages.length} articles · {roots.length} knowledge areas
          </Text>
        </View>
      </View>
      <View style={styles.section} testID="wiki-overview">
        <Text style={styles.sectionTitle}>Explore the Wiki</Text>
        {roots.length ? (
          <View style={styles.grid}>
            {roots.map((page) => (
              <KnowledgeArea key={page.id} page={page} pages={pages} onOpen={onOpen} />
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.body}>Your Wiki is ready to grow.</Text>
            <Text style={styles.muted}>
              Create an overview page for a topic, then add articles inside it. Start with a
              template below.
            </Text>
          </View>
        )}
      </View>
      {pinned.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your favorites</Text>
          <View style={styles.links}>
            {pinned.map((page) => (
              <ChoiceButton
                key={page.id}
                size="sm"
                variant="secondary"
                value={page.id}
                onSelect={onOpen}
              >
                {page.title}
              </ChoiceButton>
            ))}
          </View>
        </View>
      )}
      {recent.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recently updated</Text>
          {recent.map((page) => (
            <View key={page.id} style={styles.recent}>
              <ChoiceButton
                value={page.id}
                onSelect={onOpen}
                size="sm"
                variant="ghost"
                leftIcon={FileText}
                style={styles.recentTitle}
              >
                {page.title}
              </ChoiceButton>
              <Text style={styles.meta}>{new Date(page.updatedAt).toLocaleDateString()}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Start with a template</Text>
        <View style={styles.grid}>
          {templates.map((entry) => (
            <View key={entry.id} style={styles.template}>
              <ChoiceButton
                value={entry.id}
                onSelect={template}
                variant="ghost"
                size="sm"
                leftIcon={Plus}
                disabled={!enabled}
                style={styles.align}
              >
                {entry.title}
              </ChoiceButton>
              <Text style={styles.muted}>{entry.hint}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
function KnowledgeArea({
  page,
  pages,
  onOpen,
}: {
  page: WikiIndexEntry;
  pages: readonly WikiIndexEntry[];
  onOpen: (id: string) => void;
}) {
  const children = pages.filter((entry) => entry.parentId === page.id);
  const open = useCallback(() => onOpen(page.id), [onOpen, page.id]);
  return (
    <View style={styles.area}>
      <View style={styles.areaHeading}>
        <BookOpen size={21} color="#e3333f" />
        <Button
          size="sm"
          variant="ghost"
          leftIcon={ArrowUpRight}
          onPress={open}
          accessibilityLabel={`Open ${page.title}`}
        />
      </View>
      <ChoiceButton value={page.id} onSelect={onOpen} variant="ghost" style={styles.align}>
        {page.title}
      </ChoiceButton>
      <Text style={styles.meta}>
        {children.length ? `${children.length} subpages` : "Overview and reference"}
      </Text>
      {children.slice(0, 3).map((child) => (
        <ChoiceButton
          key={child.id}
          size="sm"
          variant="ghost"
          value={child.id}
          onSelect={onOpen}
          style={styles.align}
        >
          {child.title}
        </ChoiceButton>
      ))}
    </View>
  );
}
const styles = StyleSheet.create((theme) => ({
  home: {
    padding: 38,
    maxWidth: 1040,
    width: "100%",
    alignSelf: "center",
    gap: 36,
    paddingBottom: 72,
  },
  hero: {
    gap: 18,
    paddingTop: 18,
    paddingBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  eyebrow: { fontSize: 10, fontWeight: "600", letterSpacing: 1.7, color: "#e3333f" },
  title: { fontSize: 38, lineHeight: 45, fontWeight: "600", color: theme.colors.foreground },
  intro: { fontSize: 15, lineHeight: 24, color: theme.colors.foregroundMuted, maxWidth: 480 },
  heroActions: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 18,
    paddingTop: 4,
  },
  section: { gap: 16 },
  sectionTitle: { color: theme.colors.foreground, fontWeight: "600", fontSize: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  area: {
    flexGrow: 1,
    flexBasis: 230,
    padding: 20,
    gap: 7,
    backgroundColor: theme.colors.surface1,
    borderRadius: 12,
  },
  areaHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingLeft: 7,
  },
  template: {
    flexGrow: 1,
    flexBasis: 210,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
  },
  recent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 8,
  },
  recentTitle: { flex: 1, justifyContent: "flex-start" },
  align: { justifyContent: "flex-start" },
  links: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  muted: {
    color: theme.colors.foregroundMuted,
    fontSize: 12,
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  meta: { color: theme.colors.foregroundMuted, fontSize: 11, paddingHorizontal: 8 },
  body: { color: theme.colors.foreground, fontSize: 15 },
  empty: { padding: 24, backgroundColor: theme.colors.surface1, borderRadius: 12, gap: 10 },
}));
