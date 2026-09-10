import { ChoiceButton } from "@/components/ui/choice-button";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { WikiIndexEntry } from "@getpaseo/protocol/optimize-wiki";
import { wikiRelations, resolveWikiLink } from "@getpaseo/protocol/wiki-links";
import { Button } from "@/components/ui/button";
import { wikiAncestors } from "./wiki-structure";

interface NavigationProps {
  pages: readonly WikiIndexEntry[];
  onOpen: (id: string) => void;
}
export function WikiOverview({ pages, onOpen }: NavigationProps) {
  const roots = pages.filter((page) => !page.parentId);
  return (
    <View style={styles.section} testID="wiki-overview">
      <Text style={styles.title}>Optimize Wiki</Text>
      <Text style={styles.muted}>Company knowledge, connected.</Text>
      {roots.map((page) => (
        <View key={page.id} style={styles.card}>
          <ChoiceButton variant="ghost" value={page.id} onSelect={onOpen}>
            {page.title}
          </ChoiceButton>
          <WikiChildren pages={pages} parentId={page.id} onOpen={onOpen} />
        </View>
      ))}
    </View>
  );
}
export function WikiChildren({ pages, parentId, onOpen }: NavigationProps & { parentId: string }) {
  const children = pages.filter((page) => page.parentId === parentId);
  if (!children.length) return null;
  return (
    <View style={styles.children} testID="wiki-subpages">
      {children.map((page) => (
        <ChoiceButton key={page.id} variant="ghost" size="sm" value={page.id} onSelect={onOpen}>
          {page.title}
        </ChoiceButton>
      ))}
    </View>
  );
}
export function WikiBreadcrumbs({
  id,
  pages,
  onOpen,
  onHome,
}: NavigationProps & { id: string; onHome: () => void }) {
  const ancestors = wikiAncestors({ id, pages });
  return (
    <View style={styles.links}>
      <Button size="sm" variant="ghost" onPress={onHome}>
        Wiki home
      </Button>
      {ancestors.map((page) => (
        <View key={page.id} style={styles.links}>
          <Text style={styles.muted}>/</Text>
          <ChoiceButton size="sm" variant="ghost" value={page.id} onSelect={onOpen}>
            {page.title}
          </ChoiceButton>
        </View>
      ))}
    </View>
  );
}
export function WikiRelated({ id, pages, onOpen }: NavigationProps & { id: string }) {
  const relations = wikiRelations(pages);
  const backlinks = pages.filter((page) =>
    relations.some((link) => link.kind === "link" && link.source === page.id && link.target === id),
  );
  const current = pages.find((page) => page.id === id);
  const unresolved = current?.links.filter((target) => !resolveWikiLink({ target, pages })) ?? [];
  return (
    <View style={styles.section}>
      {pages.some((page) => page.parentId === id) && (
        <View style={styles.card}>
          <Text style={styles.heading}>Contents</Text>
          <WikiChildren pages={pages} parentId={id} onOpen={onOpen} />
        </View>
      )}
      <View style={styles.card} testID="wiki-backlinks">
        <Text style={styles.heading}>Linked from</Text>
        {backlinks.length ? (
          <View style={styles.links}>
            {backlinks.map((page) => (
              <ChoiceButton
                key={page.id}
                size="sm"
                variant="ghost"
                value={page.id}
                onSelect={onOpen}
              >
                {page.title}
              </ChoiceButton>
            ))}
          </View>
        ) : (
          <Text style={styles.muted}>No other articles link here yet.</Text>
        )}
      </View>
      {unresolved.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.heading}>Unresolved links</Text>
          <Text style={styles.muted}>{unresolved.join(" · ")}</Text>
          <Text style={styles.muted}>
            Create these pages or choose an existing article in the editor. Duplicate titles need a
            link inserted by page ID.
          </Text>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create((theme) => ({
  section: { gap: 16, marginVertical: 22 },
  title: { fontSize: 30, fontWeight: "600", color: theme.colors.foreground },
  heading: { fontSize: 15, fontWeight: "600", color: theme.colors.foreground },
  card: { backgroundColor: theme.colors.surface1, borderRadius: 14, padding: 16, gap: 10 },
  muted: { fontSize: 13, color: theme.colors.foregroundMuted, lineHeight: 21 },
  children: { paddingLeft: 12, alignItems: "flex-start", gap: 4 },
  links: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4 },
}));
