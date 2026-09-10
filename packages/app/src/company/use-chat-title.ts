import { useMemo } from "react";
import { useSessionStore, type Agent, type SessionState } from "@/stores/session-store";

interface ChatTitleSource {
  sessions: Record<string, SessionState>;
}

export function useChatAgentTitle(serverId: string, workspaceId: string): string | null {
  const select = useMemo(() => {
    let previous: Map<string, Agent> | undefined;
    let title: string | null = null;
    return (state: ChatTitleSource) => {
      const agents = state.sessions[serverId]?.agents;
      if (agents === previous) return title;
      previous = agents;
      let latest: Agent | null = null;
      for (const agent of agents?.values() ?? []) {
        if (agent.workspaceId !== workspaceId || agent.parentAgentId || agent.archivedAt) continue;
        if (!latest || agent.updatedAt > latest.updatedAt) latest = agent;
      }
      title = latest?.title ?? null;
      return title;
    };
  }, [serverId, workspaceId]);
  return useSessionStore(select);
}
