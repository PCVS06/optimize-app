import { MemoryPage } from "./memory-page";
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
import {
  buildProjectsSettingsRoute,
  buildSettingsHostSectionRoute,
  buildSettingsAddHostRoute,
} from "@/utils/host-routes";

const sections = [
  "Prompts",
  "Context",
  "Agents",
  "Models",
  "Extensions",
  "Integrations",
  "Memory",
  "Administration",
] as const;
type EngineeringSection = (typeof sections)[number];
const sectionLabels: Partial<Record<EngineeringSection, string>> = {
  Prompts: "System prompts",
  Agents: "Assistants",
};
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
  const connectHost = useCallback(() => router.push(buildSettingsAddHostRoute(Date.now())), []);
  const openHost = useCallback(
    () => router.push(buildSettingsHostSectionRoute(serverId, "host")),
    [serverId],
  );
  const openPairing = useCallback(
    () => router.push(buildSettingsHostSectionRoute(serverId, "pair-device")),
    [serverId],
  );
  const openUsage = useCallback(
    () => router.push(buildSettingsHostSectionRoute(serverId, "usage")),
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
            {sectionLabels[entry] ?? entry}
          </ChoiceButton>
        ))}
      </View>
      {section === "Prompts" && (
        <SettingsSection title="System instructions">
          <AppendSystemPromptCard serverId={serverId} />
          <AgentProfilesSection serverId={serverId} />
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
              Company instructions → project instructions → assistant system prompt → conversation
              and relevant sources. Saved memory and Wiki pages are context, not instructions.
              Changes to prompts and memory apply on the next message. Wiki articles supply
              knowledge; they do not override system instructions.
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
      {section === "Memory" && <MemoryPage serverId={serverId} />}
      {section === "Models" && <HostProvidersPage serverId={serverId} />}
      {section === "Extensions" && <HostPluginsPage serverId={serverId} />}
      {section === "Administration" && (
        <SettingsSection title="Host administration">
          <Button onPress={connectHost}>Connect company host</Button>
          <Text style={styles.description}>
            Technical setup for the person responsible for Optimize. These controls configure this
            host; they are not employee roles or access enforcement.
          </Text>
          <View style={styles.tabs}>
            <Button variant="outline" onPress={openHost}>
              Host status
            </Button>
            <Button variant="outline" onPress={openConnections}>
              Connections
            </Button>
            <Button variant="outline" onPress={openPairing}>
              Pair a device
            </Button>
            <Button variant="outline" onPress={openUsage}>
              Usage
            </Button>
          </View>
        </SettingsSection>
      )}
      {section === "Integrations" && (
        <SettingsSection title="Company tools">
          <View style={styles.card}>
            <Text style={styles.heading}>Microsoft 365</Text>
            <Text style={styles.description}>
              Outlook, contacts, calendars, OneDrive, SharePoint, Teams, OneNote, tasks, and Excel
              workbooks. Word and PowerPoint files can be downloaded, edited in their Mac apps, and
              uploaded again.
            </Text>
            <Text style={styles.description}>
              In a chat, ask “Connect Microsoft 365” or enter /microsoft. The first connection needs
              your company’s Microsoft Entra application ID. You sign in directly with Microsoft;
              access stays within your account’s permissions and company consent policy.
            </Text>
            <Text style={styles.description}>
              Credentials are stored in this Mac’s Keychain. Use /microsoft status to check the
              connection, /microsoft finish after sign-in, and /microsoft disconnect to remove it.
              The assistant asks before applying Microsoft changes.
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.heading}>Computer use</Text>
            <Text style={styles.description}>
              The bundled Mac assistant can observe the main display, open apps, click, type, use
              keyboard shortcuts, and scroll. Ask the assistant to operate an app or enter /computer
              to enable it for a conversation.
            </Text>
            <Text style={styles.description}>
              macOS requires Screen Recording and Accessibility for Optimize Automation. Use
              /computer off to stop access in that conversation. The assistant operates the Mac
              where its runtime is running.
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.heading}>Wiki authoring skill</Text>
            <Text style={styles.description}>
              Built into the Mac app. The assistant uses article structures, source rules, overview
              pages, durable links, and conflict-aware publication. Ask it to create or update an
              article; drafts requested in chat stay unpublished.
            </Text>
          </View>
        </SettingsSection>
      )}
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
