import { memo, useCallback, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type {
  AgentFeature,
  AgentMode,
  AgentModelDefinition,
  AgentProvider,
} from "@getpaseo/protocol/agent-types";
import type { AgentProviderDefinition } from "@getpaseo/protocol/provider-manifest";
import type { ProviderSelectorProvider } from "@/provider-selection/provider-selection";
import { useSessionStore } from "@/stores/session-store";
import { SelectField } from "@/components/ui/select-field";
import { OptimizeLogo } from "@/components/icons/optimize-logo";
import {
  useAgentProfilePicker,
  type AgentProfilePicker,
  type AgentProfileApplyTarget,
  type DraftAgentProfileControls,
} from "@/agent-profiles";

export interface DraftAgentControlsProps {
  providerDefinitions: AgentProviderDefinition[];
  selectedProvider: AgentProvider | null;
  selectedProfileId?: string;
  modeOptions: AgentMode[];
  selectedMode: string;
  onSelectMode: (modeId: string) => void;
  models: AgentModelDefinition[];
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  isModelLoading: boolean;
  modelSelectorProviders: ProviderSelectorProvider[];
  isAllModelsLoading: boolean;
  onSelectProviderAndModel: (provider: AgentProvider, modelId: string) => void;
  thinkingOptions: NonNullable<AgentModelDefinition["thinkingOptions"]>;
  selectedThinkingOptionId: string;
  onSelectThinkingOption: (thinkingOptionId: string) => void;
  onApplyAgentProfile: DraftAgentProfileControls["applyProfile"];
  features?: AgentFeature[];
  onSetFeature?: (featureId: string, value: unknown) => void;
  onDropdownClose?: () => void;
  onModelSelectorOpen?: () => void;
  onRetryModelProvider?: (provider: AgentProvider) => void;
  isRetryingModelProvider?: boolean;
  disabled?: boolean;
  modelSelectorServerId?: string | null;
  isCompactLayout?: boolean;
}

interface AgentControlsProps {
  agentId: string;
  serverId: string;
  onDropdownClose?: () => void;
  isCompactLayout?: boolean;
}

const PI_PROVIDERS = ["pi"];
const ASSISTANT_LOGO = <OptimizeLogo size={18} />;
const DEFAULT_ASSISTANT_ID = "__optimize_default__";

interface AssistantPickerProps {
  picker: AgentProfilePicker | null;
  selectedProfileId?: string;
  disabled?: boolean;
  onDropdownClose?: () => void;
}

function AssistantPicker({
  picker,
  selectedProfileId,
  disabled = false,
  onDropdownClose,
}: AssistantPickerProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = useMemo(
    () =>
      picker?.rows.length
        ? [
            { id: DEFAULT_ASSISTANT_ID, value: DEFAULT_ASSISTANT_ID, label: "Optimize" },
            ...picker.rows.map((row) => ({ id: row.id, value: row.id, label: row.name })),
          ]
        : [],
    [picker],
  );
  const selected = options.find(
    (option) => option.id === (selectedProfileId ?? DEFAULT_ASSISTANT_ID),
  );
  const selectedDisplay = useMemo(() => (selected ? { label: selected.label } : null), [selected]);
  const selectAssistant = useCallback(
    async (id: string) => {
      if (!picker) return;
      setPending(true);
      setError(null);
      try {
        await picker.applyProfile(id === DEFAULT_ASSISTANT_ID ? null : id);
        onDropdownClose?.();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not change assistant. Try again.");
      } finally {
        setPending(false);
      }
    },
    [picker, onDropdownClose],
  );

  const handleSelect = useCallback(
    (id: string) => {
      void selectAssistant(id);
    },
    [selectAssistant],
  );

  if (options.length === 0) {
    return (
      <View style={styles.defaultAssistant}>
        <OptimizeLogo size={18} />
        <Text style={styles.label}>Optimize</Text>
      </View>
    );
  }
  return (
    <View style={styles.container}>
      <SelectField
        label="Assistant"
        title="Choose an assistant"
        field={false}
        size="sm"
        value={selected?.id ?? null}
        selectedDisplay={selectedDisplay}
        placeholder="Optimize"
        emptyText="No assistants configured"
        options={options}
        onChange={handleSelect}
        disabled={disabled || pending}
        loading={pending}
        triggerLeading={ASSISTANT_LOGO}
        triggerTestID="company-assistant-picker"
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export const AgentControls = memo(function AgentControls({
  agentId,
  serverId,
  onDropdownClose,
}: AgentControlsProps) {
  const profileId = useSessionStore(
    (state) => state.sessions[serverId]?.agents.get(agentId)?.profileId,
  );
  const client = useSessionStore((state) => state.sessions[serverId]?.client ?? null);
  const availableModes = useSessionStore(
    (state) => state.sessions[serverId]?.agents.get(agentId)?.availableModes,
  );
  const target = useMemo<AgentProfileApplyTarget>(
    () => ({
      kind: "agent",
      agentId,
      availableModeIds: availableModes?.map((mode) => mode.id) ?? null,
    }),
    [agentId, availableModes],
  );
  const picker = useAgentProfilePicker({ serverId, availableProviders: PI_PROVIDERS, target });
  return (
    <AssistantPicker
      picker={picker}
      selectedProfileId={profileId}
      disabled={!client}
      onDropdownClose={onDropdownClose}
    />
  );
});

export function DraftAgentControls({
  onApplyAgentProfile,
  selectedProfileId,
  modelSelectorServerId = null,
  disabled = false,
  onDropdownClose,
}: DraftAgentControlsProps) {
  const target = useMemo<AgentProfileApplyTarget>(
    () => ({ kind: "draft", controls: { applyProfile: onApplyAgentProfile } }),
    [onApplyAgentProfile],
  );
  const picker = useAgentProfilePicker({
    serverId: modelSelectorServerId,
    availableProviders: PI_PROVIDERS,
    target,
  });
  return (
    <AssistantPicker
      picker={picker}
      selectedProfileId={selectedProfileId}
      disabled={disabled}
      onDropdownClose={onDropdownClose}
    />
  );
}

const styles = StyleSheet.create((theme) => ({
  container: { minWidth: 120, maxWidth: 240 },
  defaultAssistant: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    paddingHorizontal: theme.spacing[2],
  },
  label: { color: theme.colors.foregroundMuted, fontSize: theme.fontSize.base },
  error: { color: theme.colors.destructive, fontSize: theme.fontSize.sm },
}));
