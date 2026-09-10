import type { Agent, ProjectDescriptor, WorkspaceDescriptor } from "@/stores/session-store";

export interface CompanyChatRow {
  key: string;
  serverId: string;
  workspaceId: string;
  projectId: string;
  title: string;
  pinned: boolean;
  busy: boolean;
  updatedAt: number;
}
export interface CompanyProjectRow {
  key: string;
  serverId: string;
  projectId: string;
  name: string;
  chats: CompanyChatRow[];
}
export interface CompanySidebarSource {
  serverId: string;
  projects: Iterable<ProjectDescriptor>;
  workspaces: Iterable<WorkspaceDescriptor>;
  agents: Iterable<Agent>;
}

export function buildCompanySidebar(sources: CompanySidebarSource[]) {
  const projects: CompanyProjectRow[] = [];
  const chats: CompanyChatRow[] = [];
  const pinned: CompanyChatRow[] = [];
  for (const source of sources) {
    const byProject = new Map<string, CompanyProjectRow>();
    for (const project of source.projects) {
      if (project.companyKind === "chats") continue;
      const row: CompanyProjectRow = {
        key: `${source.serverId}:${project.projectId}`,
        serverId: source.serverId,
        projectId: project.projectId,
        name: project.projectCustomName || project.projectDisplayName,
        chats: [],
      };
      projects.push(row);
      byProject.set(project.projectId, row);
    }
    const primaryAgents = new Map<string, Agent>();
    for (const agent of source.agents) {
      if (!agent.workspaceId || agent.parentAgentId || agent.archivedAt) continue;
      const current = primaryAgents.get(agent.workspaceId);
      if (!current || agent.updatedAt > current.updatedAt)
        primaryAgents.set(agent.workspaceId, agent);
    }
    for (const workspace of source.workspaces) {
      if (workspace.archivingAt) continue;
      const agent = primaryAgents.get(workspace.id);
      const row = chatRow(source.serverId, workspace, agent);
      if (row.pinned) pinned.push(row);
      const project = byProject.get(workspace.projectId);
      if (project) project.chats.push(row);
      else chats.push(row);
    }
  }
  const latestFirst = (a: CompanyChatRow, b: CompanyChatRow) =>
    b.updatedAt - a.updatedAt || a.key.localeCompare(b.key);
  chats.sort(latestFirst);
  pinned.sort(latestFirst);
  projects.sort((a, b) => a.name.localeCompare(b.name));
  for (const project of projects) project.chats.sort(latestFirst);
  return { chats, projects, pinned };
}

function chatRow(serverId: string, workspace: WorkspaceDescriptor, agent?: Agent): CompanyChatRow {
  return {
    key: `${serverId}:${workspace.id}`,
    serverId,
    workspaceId: workspace.id,
    projectId: workspace.projectId,
    title: workspace.title || agent?.title || workspace.name || "New chat",
    pinned: Boolean(workspace.pinnedAt),
    busy: workspace.status === "running",
    updatedAt: agent?.lastActivityAt?.getTime() || workspace.statusEnteredAt?.getTime() || 0,
  };
}
