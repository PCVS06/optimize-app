import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Button } from "@/components/ui/button";
import { MenuHeader } from "@/components/headers/menu-header";
import { OptimizeLogo } from "@/components/icons/optimize-logo";
import { useCompanyHost } from "@/company/use-company-host";
import { getHostRuntimeStore } from "@/runtime/host-runtime";
import {
  normalizeProjectDescriptor,
  normalizeWorkspaceDescriptor,
  useSessionStore,
} from "@/stores/session-store";
import { navigateToWorkspace } from "@/stores/navigation-active-workspace-store";

/** The existing workspace composer owns messages; this surface only allocates a company chat. */
export function CompanyNewChatScreen({
  serverId: preferredServerId,
  projectId,
}: {
  serverId?: string;
  projectId?: string;
}) {
  const { serverId, client, connected, supported } = useCompanyHost(preferredServerId);
  const pending = useRef<ReturnType<NonNullable<typeof client>["createCompanyChat"]> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!client || !connected || !supported) return;
    pending.current ??= client.createCompanyChat(projectId);
    let present = true;
    void pending.current
      .then((result) => {
        if (result.error || !result.workspace || !result.project) {
          throw new Error(result.error || "Your chat could not be created.");
        }
        const workspace = normalizeWorkspaceDescriptor(result.workspace);
        useSessionStore
          .getState()
          .upsertProject(serverId, normalizeProjectDescriptor(result.project));
        getHostRuntimeStore().acceptWorkspaceSnapshots(serverId, [workspace]);
        if (present) navigateToWorkspace({ serverId, workspaceId: workspace.id });
        return workspace;
      })
      .catch((cause) => {
        if (present)
          setError(cause instanceof Error ? cause.message : "Your chat could not be created.");
      });
    return () => {
      present = false;
    };
  }, [client, connected, projectId, retry, serverId, supported]);
  const retryCreate = useCallback(() => {
    pending.current = null;
    setError(null);
    setRetry((value) => value + 1);
  }, []);
  let hint = "Connecting to Optimize…";
  if (connected)
    hint = supported ? "Opening your conversation…" : "Update Optimize to use chats and projects.";
  return (
    <View style={styles.screen} testID="company-new-chat">
      <MenuHeader title="New chat" borderless />
      <View style={styles.body}>
        <OptimizeLogo size={46} />
        <Text style={styles.title}>{error ? "Could not open chat" : "New chat"}</Text>
        <Text style={styles.hint}>{error || hint}</Text>
        {error ? <Button onPress={retryCreate}>Try again</Button> : null}
      </View>
    </View>
  );
}
const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  body: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18, padding: 32 },
  title: { color: theme.colors.foreground, fontSize: 26, fontWeight: "600" },
  hint: { color: theme.colors.foregroundMuted, fontSize: 15, textAlign: "center" },
  button: {
    backgroundColor: theme.colors.accent,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonText: { color: theme.colors.accentForeground, fontWeight: "600" },
}));
