import { ChoiceButton } from "@/components/ui/choice-button";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { StyleSheet } from "react-native-unistyles";
import { Button } from "@/components/ui/button";
import { SettingsSection } from "@/components/settings/headings/settings-section";
import { AgentProfilesSection } from "@/agent-profiles";
import { AgentSkillsSection } from "@/agent-skills";
import { AppendSystemPromptCard, InjectPaseoToolsCard, HostProvidersPage } from "./host-page";
import { BrowserToolsOptInCard } from "./browser-tools-card";
import { HostPluginsPage } from "./plugins-page";
import { buildProjectsSettingsRoute, buildSettingsHostSectionRoute } from "@/utils/host-routes";

const sections = ["Prompts", "Context", "Agents", "Models", "Extensions"] as const;
type EngineeringSection = (typeof sections)[number];
export function EngineeringPage({
  serverId,
  initialSection = "Prompts",
}: {
  serverId: string;
  initialSection?: EngineeringSection;
}) {
  const [section, setSection] = useState<EngineeringSection>(initialSection);
  const openProjects = useCallback(
    () => router.push(buildProjectsSettingsRoute(serverId)),
    [serverId],
  );
  const openWiki = useCallback(() => router.push("/wiki"), []);
  const openConnections = useCallback(
    () => router.push(buildSettingsHostSectionRoute(serverId, "connections")),
    [serverId],
  );
  return (
    <View style={styles.page} testID="engineering-page">
      <View>
        <Text style={styles.title}>Engineering</Text>
        <Text style={styles.description}>Configure the Optimize harness for your company.</Text>
      </View>
      <View style={styles.tabs}>
        {sections.map((entry) => (
          <ChoiceButton
            key={entry}
            size="sm"
            variant={entry === section ? "secondary" : "ghost"}
            value={entry}
            onSelect={setSection}
            testID={`engineering-tab-${entry.toLowerCase()}`}
          >
            {entry}
          </ChoiceButton>
        ))}
      </View>
      {section === "Prompts" && (
        <SettingsSection title="System instructions">
          <AppendSystemPromptCard serverId={serverId} />
          <View style={styles.card}>
            <Text style={styles.heading}>Project instructions</Text>
            <Text style={styles.description}>
              Set the task, vocabulary, and working rules for each project. Company instructions
              apply across projects; project instructions add local context.
            </Text>
            <Button size="sm" variant="outline" onPress={openProjects}>
              Configure project prompts
            </Button>
          </View>
          <View style={styles.card}>
            <Text style={styles.heading}>How context is assembled</Text>
            <Text style={styles.description}>
              Company instructions → Wiki access guidance → project instructions → conversation and
              relevant sources. Wiki articles supply knowledge; they do not override system
              instructions.
            </Text>
          </View>
        </SettingsSection>
      )}
      {section === "Context" && (
        <SettingsSection title="Context engineering">
          <View style={styles.card}>
            <Text style={styles.heading}>Company knowledge</Text>
            <Text style={styles.description}>
              The assistant reads the latest saved Wiki pages when needed, follows relevant article
              links, and cites the page titles. Keep source links and headings in your articles to
              make the context easy to verify.
            </Text>
            <Button size="sm" variant="outline" onPress={openWiki}>
              Open Optimize Wiki
            </Button>
          </View>
          <InjectPaseoToolsCard serverId={serverId} />
          <BrowserToolsOptInCard serverId={serverId} />
          <View style={styles.card}>
            <Text style={styles.heading}>Share with the team</Text>
            <Text style={styles.description}>
              Devices connected to this host share one Wiki. Separate local hosts have separate
              knowledge. Device permissions currently apply to the whole host; employee accounts and
              Wiki-specific roles are not configured here yet.
            </Text>
            <Button size="sm" variant="outline" onPress={openConnections}>
              Manage host connections
            </Button>
          </View>
        </SettingsSection>
      )}
      {section === "Agents" && (
        <SettingsSection title="Agent behavior">
          <AgentProfilesSection serverId={serverId} />
          <AgentSkillsSection serverId={serverId} />
        </SettingsSection>
      )}
      {section === "Models" && <HostProvidersPage serverId={serverId} />}
      {section === "Extensions" && <HostPluginsPage serverId={serverId} />}
    </View>
  );
}
const styles = StyleSheet.create((theme) => ({
  page: { gap: 24 },
  title: { fontSize: 28, fontWeight: "600", color: theme.colors.foreground },
  description: { color: theme.colors.foregroundMuted, fontSize: 14, lineHeight: 22 },
  heading: { color: theme.colors.foreground, fontSize: 16, fontWeight: "600" },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  card: {
    backgroundColor: theme.colors.surface1,
    borderRadius: 14,
    padding: 20,
    gap: 12,
    marginBottom: 16,
    alignItems: "flex-start",
  },
}));
