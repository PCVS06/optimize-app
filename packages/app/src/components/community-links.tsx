import { useCallback, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native-unistyles";
import { Globe, FileText } from "lucide-react-native";
import { AdaptiveModalSheet } from "@/components/adaptive-modal-sheet";
import { Button } from "@/components/ui/button";
import { openExternalUrl } from "@/utils/open-external-url";

const LICENSE_LINKS = [
  {
    label: "Paseo — Apache-2.0 · © Mohamed Boudra",
    url: "https://github.com/getpaseo/paseo/blob/v0.8.0/LICENSE",
  },
  {
    label: "Pi — MIT · © Mario Zechner",
    url: "https://github.com/badlogic/pi-mono/blob/main/LICENSE",
  },
  {
    label: "Jost — SIL Open Font License",
    url: "https://github.com/PCVS06/optimize-app/blob/optimize/initial-build/packages/app/public/fonts/OFL-Jost.txt",
  },
];
const LICENSE_SNAP_POINTS = ["60%"];

export function CommunityLinks() {
  const { t } = useTranslation();
  const [licensesOpen, setLicensesOpen] = useState(false);
  const header = useMemo(() => ({ title: t("optimize.licensesTitle") }), [t]);
  const openWebsite = useCallback(() => {
    void openExternalUrl("https://www.optimize.bike/");
  }, []);
  const openLicenses = useCallback(() => setLicensesOpen(true), []);
  const closeLicenses = useCallback(() => setLicensesOpen(false), []);
  return (
    <>
      <View style={styles.row}>
        <Button variant="ghost" size="sm" leftIcon={Globe} onPress={openWebsite}>
          {t("optimize.website")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={FileText}
          onPress={openLicenses}
          testID="optimize-licenses"
        >
          {t("optimize.licenses")}
        </Button>
      </View>
      <AdaptiveModalSheet
        header={header}
        visible={licensesOpen}
        onClose={closeLicenses}
        desktopMaxWidth={560}
        snapPoints={LICENSE_SNAP_POINTS}
        testID="optimize-licenses-sheet"
      >
        <ScrollView contentContainerStyle={styles.licenses}>
          <Text style={styles.description}>{t("optimize.licensesDescription")}</Text>
          {LICENSE_LINKS.map((license) => (
            <LicenseLink key={license.label} license={license} />
          ))}
        </ScrollView>
      </AdaptiveModalSheet>
    </>
  );
}
function LicenseLink({ license }: { license: (typeof LICENSE_LINKS)[number] }) {
  const open = useCallback(() => {
    void openExternalUrl(license.url);
  }, [license.url]);
  return (
    <Button variant="ghost" size="sm" onPress={open}>
      {license.label}
    </Button>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  licenses: { gap: theme.spacing[4], paddingBottom: theme.spacing[6] },
  description: { color: theme.colors.foregroundMuted, fontSize: theme.fontSize.base },
}));
