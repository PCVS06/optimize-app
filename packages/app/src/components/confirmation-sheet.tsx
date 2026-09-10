import { useCallback, useMemo } from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { AdaptiveModalSheet } from "@/components/adaptive-modal-sheet";
import { Button } from "@/components/ui/button";

interface ConfirmationSheetProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  testID?: string;
}

/** Keeps confirmation, progress and recoverable errors together in the company app. */
export function ConfirmationSheet({
  visible,
  title,
  message,
  confirmLabel,
  pending = false,
  error,
  onConfirm,
  onCancel,
  testID,
}: ConfirmationSheetProps) {
  const header = useMemo(() => ({ title }), [title]);
  const close = useCallback(() => {
    if (!pending) onCancel();
  }, [pending, onCancel]);
  const footer = useMemo(
    () => (
      <View style={styles.actions}>
        <Button variant="ghost" onPress={close} disabled={pending}>
          Cancel
        </Button>
        <Button variant="destructive" onPress={onConfirm} disabled={pending} loading={pending}>
          {confirmLabel}
        </Button>
      </View>
    ),
    [close, onConfirm, pending, confirmLabel],
  );
  return (
    <AdaptiveModalSheet
      visible={visible}
      header={header}
      onClose={close}
      footer={footer}
      testID={testID}
    >
      <View style={styles.body}>
        <Text style={styles.message}>{message}</Text>
        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </View>
    </AdaptiveModalSheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  body: { gap: theme.spacing[4] },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: theme.spacing[2] },
  message: { color: theme.colors.foregroundMuted, fontSize: theme.fontSize.base, lineHeight: 22 },
  error: { color: theme.colors.destructive, fontSize: theme.fontSize.base },
}));
