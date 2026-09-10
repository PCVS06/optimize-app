import { useCallback, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { router } from "expo-router";
import { AdaptiveModalSheet } from "@/components/adaptive-modal-sheet";
import { Button } from "@/components/ui/button";
import { Field, FormTextInput } from "@/components/ui/form-field";
import { useCompanyHost } from "./use-company-host";
import { normalizeProjectDescriptor, useSessionStore } from "@/stores/session-store";
import { buildNewWorkspaceRoute } from "@/utils/host-routes";
import type { AddProjectFlowRequest } from "@/stores/add-project-flow-store";

interface CompanyProjectDialogProps {
  request: AddProjectFlowRequest;
  onClose: () => void;
}
const HEADER = { title: "New project" };

export function CompanyProjectDialog({ request, onClose }: CompanyProjectDialogProps) {
  const { serverId, client, connected, supported } = useCompanyHost(request.preferredHostId);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = useCallback(async () => {
    if (saving || !name.trim() || !client || !connected || !supported) return;
    setSaving(true);
    setError(null);
    try {
      const result = await client.createCompanyProject(name.trim());
      if (!result.project || result.error)
        throw new Error(result.error || "Could not create project.");
      useSessionStore
        .getState()
        .upsertProject(serverId, normalizeProjectDescriptor(result.project));
      onClose();
      router.push(buildNewWorkspaceRoute({ serverId, projectId: result.project.projectId }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create project.");
    } finally {
      setSaving(false);
    }
  }, [saving, name, client, connected, supported, serverId, onClose]);
  const footer = useMemo(
    () => (
      <View style={styles.actions}>
        <Button variant="ghost" onPress={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          onPress={create}
          disabled={saving || !name.trim() || !connected || !supported}
          loading={saving}
          testID="company-project-create"
        >
          Create project
        </Button>
      </View>
    ),
    [create, onClose, saving, name, connected, supported],
  );
  let connectionHint: string | undefined;
  if (!connected) connectionHint = "Connecting to Optimize…";
  else if (!supported) connectionHint = "Update Optimize to create projects.";
  return (
    <AdaptiveModalSheet
      visible
      header={HEADER}
      onClose={onClose}
      footer={footer}
      testID="company-project-dialog"
    >
      <View style={styles.body}>
        <Text style={styles.description}>
          Keep related chats, instructions and knowledge together.
        </Text>
        <Field label="Project name" error={error} hint={connectionHint}>
          <FormTextInput
            autoFocus
            onChangeText={setName}
            placeholder="For example: Customer support"
            maxLength={120}
            accessibilityLabel="Project name"
            testID="company-project-name"
            editable={!saving}
            onSubmitEditing={create}
          />
        </Field>
      </View>
    </AdaptiveModalSheet>
  );
}
const styles = StyleSheet.create((theme) => ({
  body: { gap: theme.spacing[4] },
  description: {
    fontSize: theme.fontSize.base,
    lineHeight: 22,
    color: theme.colors.foregroundMuted,
  },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: theme.spacing[2] },
}));
