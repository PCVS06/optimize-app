export interface AcpProviderCatalogEntry {
  id: string;
  title: string;
  description: string;
  version: string;
  iconSvg: string | null;
  installLink: string;
  command: readonly [string, ...string[]];
  env?: Readonly<Record<string, string>>;
  params?: Readonly<Record<string, unknown>>;
}

export const ACP_PROVIDER_CATALOG: AcpProviderCatalogEntry[] = [];
