import { useHosts, useHostRuntimeClient, useHostRuntimeIsConnected } from "@/runtime/host-runtime";
import { useLocalDaemonServerId } from "@/hooks/use-is-local-daemon";
import { useHostFeature } from "@/runtime/host-features";
import { useLastWorkspaceSelection } from "@/stores/navigation-active-workspace-store";

export function useCompanyHost(preferredServerId?: string) {
  const hosts = useHosts();
  const localServerId = useLocalDaemonServerId();
  const lastSelection = useLastWorkspaceSelection();
  const serverId =
    preferredServerId || localServerId || lastSelection?.serverId || hosts[0]?.serverId || "";
  const client = useHostRuntimeClient(serverId);
  const connected = useHostRuntimeIsConnected(serverId);
  const supported = useHostFeature(serverId, "companyChats");
  return { serverId, client, connected, supported };
}
