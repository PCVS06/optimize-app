import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native-unistyles";

/** Optimize keeps technical controls available behind a single disclosure. */
export function AdvancedOptions({
  children,
  forceOpen = false,
  testID = "advanced-options",
}: {
  children: ReactNode;
  forceOpen?: boolean;
  testID?: string;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const isOpen = forceOpen || expanded;
  const accessibilityState = useMemo(() => ({ expanded: isOpen }), [isOpen]);
  const toggle = useCallback(() => setExpanded((value) => !value), []);
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={accessibilityState}
        onPress={toggle}
        style={styles.trigger}
        testID={testID}
      >
        <Text style={styles.label}>{t("optimize.advanced")}</Text>
        <ChevronDown
          size={14}
          color={styles.label.color}
          style={isOpen ? styles.expanded : undefined}
        />
      </Pressable>
      {isOpen ? children : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: { marginTop: theme.spacing[3] },
  trigger: {
    minHeight: 40,
    paddingHorizontal: theme.spacing[2],
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    borderRadius: theme.borderRadius.lg,
  },
  label: { color: theme.colors.foregroundMuted, fontSize: theme.fontSize.base },
  expanded: { transform: [{ rotate: "180deg" }] },
}));
