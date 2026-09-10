import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ComponentType,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { Globe, SquarePen } from "lucide-react-native";
import invariant from "tiny-invariant";
import { resolvePluginIcon } from "@/plugins/icons";
import { useInstalledPlugins } from "@/plugins/registry";
import { pluginPanelSupportsLocation } from "@/plugins/workspace-panels/locations";
import type { NewTabSelection } from "@/workspace-tabs/new-tab";
import type { WorkspaceTabTarget } from "@/workspace-tabs/model";
import { panelSupportsHost, type PaneHost } from "@/panels/panel-manifest";
import type { PanelIconProps } from "@/panels/panel-registry";
import { getBuiltInLaunchOrder, type BuiltInLaunchItemId } from "./internal/catalog";

export type WorkspaceTabLaunchPurpose = "primary" | "supporting";

export type WorkspaceTabLaunchDestination =
  | { kind: "open"; paneId?: string }
  | { kind: "replace"; tabId: string };

export interface NewTabLauncher {
  showChanges: boolean;
  showPullRequest: boolean;
  showBrowser: boolean;
  terminalDisabled: boolean;
  launch: (selection: NewTabSelection, destination: WorkspaceTabLaunchDestination) => void;
}

export interface WorkspaceTabLaunchItem {
  id: string;
  label: string;
  Icon?: ComponentType<PanelIconProps>;
  terminalIconKey?: string;
  shortcutActionId?: string;
  disabled: boolean;
  panelKind: WorkspaceTabTarget["kind"];
  /** The fixed view this item can toggle in a configuration menu, or null for launch-only items. */
  toggleTarget: WorkspaceTabTarget | null;
  launch: (destination: WorkspaceTabLaunchDestination) => void;
}

export interface WorkspaceTabLaunchGroup {
  id: "tabs" | "plugin-panels" | "terminal-profiles";
  label: string | null;
  items: readonly WorkspaceTabLaunchItem[];
  accessory?: { id: string; label: string; run: () => void };
}

const NewTabLauncherContext = createContext<NewTabLauncher | null>(null);

export function NewTabLauncherProvider({
  value,
  children,
}: {
  value: NewTabLauncher;
  children: ReactNode;
}) {
  return <NewTabLauncherContext.Provider value={value}>{children}</NewTabLauncherContext.Provider>;
}

export function useWorkspaceTabLaunchCatalog(input: {
  serverId: string;
  purpose: WorkspaceTabLaunchPurpose;
  host: PaneHost;
}): readonly WorkspaceTabLaunchGroup[] {
  const { serverId, purpose, host } = input;
  const { t } = useTranslation();
  const launcher = useContext(NewTabLauncherContext);
  invariant(launcher, "NewTabLauncherProvider is required");
  const plugins = useInstalledPlugins();
  const launchSelection = useCallback(
    (selection: NewTabSelection) => (destination: WorkspaceTabLaunchDestination) => {
      launcher.launch(selection, destination);
    },
    [launcher],
  );
  return useMemo(() => {
    const builtIns: Record<BuiltInLaunchItemId, WorkspaceTabLaunchItem> = {
      agent: {
        id: "agent",
        label: t("optimize.newConversation"),
        Icon: SquarePen,
        shortcutActionId: "workspace-tab-target-agent",
        disabled: false,
        panelKind: "draft",
        toggleTarget: null,
        launch: launchSelection({ kind: "agent" }),
      },
      browser: {
        id: "browser",
        label: t("workspace.tabs.fallback.browser"),
        Icon: Globe,
        shortcutActionId: "workspace-tab-target-browser",
        disabled: false,
        panelKind: "browser",
        toggleTarget: null,
        launch: launchSelection({ kind: "browser" }),
      },
    };
    const items = getBuiltInLaunchOrder(purpose).flatMap((id) => {
      if (id === "browser" && !launcher.showBrowser) return [];
      const item = builtIns[id];
      return panelSupportsHost(item.panelKind, host) ? [item] : [];
    });
    const pluginItems: WorkspaceTabLaunchItem[] = [];
    for (const plugin of plugins) {
      if (plugin.serverId !== serverId) continue;
      for (const panel of plugin.workspacePanels) {
        if (panel.context !== "workspace") continue;
        const location = host === "explorer" ? "explorer" : "workspace";
        if (!pluginPanelSupportsLocation(panel, location)) continue;
        const target: WorkspaceTabTarget = {
          kind: "plugin",
          pluginId: plugin.id,
          panelId: panel.id,
          context: "workspace",
        };
        pluginItems.push({
          id: `plugin:${plugin.id}:${panel.id}`,
          label: panel.title,
          Icon: resolvePluginIcon(panel.icon),
          disabled: false,
          panelKind: "plugin",
          toggleTarget: target,
          launch: launchSelection({ kind: "target", target }),
        });
      }
    }
    const groups: WorkspaceTabLaunchGroup[] = [{ id: "tabs", label: null, items }];
    if (pluginItems.length > 0)
      groups.push({ id: "plugin-panels", label: null, items: pluginItems });
    return groups;
  }, [host, launchSelection, launcher.showBrowser, plugins, purpose, serverId, t]);
}

export { getBuiltInLaunchOrder } from "./internal/catalog";
