import { Bot } from "lucide-react-native";
import { createElement, type ComponentType } from "react";
import { SvgXml } from "react-native-svg";
import { OptimizeLogo } from "@/components/icons/optimize-logo";
import { ACP_PROVIDER_CATALOG } from "@/data/acp-provider-catalog";
import { resolveProviderIconName } from "@/components/provider-icon-name";

export interface ProviderIconProps {
  size: number;
  color: string;
}

export type ProviderIconComponent = ComponentType<ProviderIconProps>;

const BUILTIN_PROVIDER_ICONS: Record<string, ProviderIconComponent> = {
  pi: OptimizeLogo,
};

const CATALOG_ICON_SVGS = new Map(
  ACP_PROVIDER_CATALOG.flatMap((entry) => (entry.iconSvg ? [[entry.id, entry.iconSvg]] : [])),
);

const catalogIconComponents = new Map<string, ProviderIconComponent>();
const snapshotIconComponents = new Map<string, { svg: string; component: ProviderIconComponent }>();

function createSvgIcon(provider: string, iconSvg: string): ProviderIconComponent {
  const SvgProviderIcon: ProviderIconComponent = ({ size, color }) =>
    createElement(SvgXml, {
      xml: iconSvg,
      width: size,
      height: size,
      color,
    });
  SvgProviderIcon.displayName = `SvgProviderIcon(${provider})`;
  return SvgProviderIcon;
}

function getCatalogProviderIcon(provider: string): ProviderIconComponent {
  const cached = catalogIconComponents.get(provider);
  if (cached) {
    return cached;
  }
  const iconSvg = CATALOG_ICON_SVGS.get(provider);
  if (!iconSvg) {
    return Bot;
  }
  const icon = createSvgIcon(provider, iconSvg);
  catalogIconComponents.set(provider, icon);
  return icon;
}

function getSnapshotProviderIcon(provider: string, svg: string): ProviderIconComponent {
  const cached = snapshotIconComponents.get(provider);
  if (cached?.svg === svg) return cached.component;
  const component = createSvgIcon(provider, svg);
  snapshotIconComponents.set(provider, { svg, component });
  return component;
}

export function getProviderIcon(provider: string, serverId?: string | null): ProviderIconComponent {
  const name = resolveProviderIconName(provider, serverId);
  if (name.kind === "builtin") {
    return BUILTIN_PROVIDER_ICONS[name.id] ?? Bot;
  }
  if (name.kind === "catalog") {
    return getCatalogProviderIcon(name.id);
  }
  if (name.kind === "svg") {
    return getSnapshotProviderIcon(`${serverId}:${provider}`, name.svg);
  }
  return Bot;
}
