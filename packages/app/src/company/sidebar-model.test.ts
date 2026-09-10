import { describe, expect, test } from "vitest";
import type { ProjectDescriptor, WorkspaceDescriptor } from "@/stores/session-store";
import { resolveWorkspaceHeader } from "../screens/workspace/workspace-header-source";
import { buildCompanySidebar } from "./sidebar-model";

function project(projectId: string, companyKind?: "project" | "chats"): ProjectDescriptor {
  return {
    projectId,
    companyKind,
    projectDisplayName: projectId,
    projectCustomName: null,
    projectRootPath: `/private/${projectId}`,
    projectKind: "non_git",
  };
}
function workspace(id: string, projectId: string): WorkspaceDescriptor {
  return {
    id,
    projectId,
    projectDisplayName: projectId,
    projectRootPath: `/private/${projectId}`,
    workspaceDirectory: `/private/runtime/${id}`,
    projectKind: "non_git",
    workspaceKind: "directory",
    name: id,
    status: "done",
    statusEnteredAt: null,
    archivingAt: null,
    diffStat: null,
    scripts: [],
  };
}

describe("company sidebar", () => {
  test("shows free chats outside projects while preserving legacy and empty projects", () => {
    const result = buildCompanySidebar([
      {
        serverId: "mac",
        projects: [
          project("hidden", "chats"),
          project("Support", "project"),
          project("Legacy"),
          project("Empty", "project"),
        ],
        workspaces: [
          workspace("free", "hidden"),
          workspace("customer", "Support"),
          workspace("old", "Legacy"),
        ],
        agents: [],
      },
    ]);
    expect(result.chats.map((chat) => chat.workspaceId)).toEqual(["free"]);
    expect(result.projects.map((entry) => entry.name)).toEqual(["Empty", "Legacy", "Support"]);
    expect(
      result.projects
        .find((entry) => entry.name === "Support")
        ?.chats.map((chat) => chat.workspaceId),
    ).toEqual(["customer"]);
    expect(JSON.stringify(result)).not.toContain("/private");
  });
  test("moving a workspace changes only the grouping, never its key", () => {
    const sources = {
      serverId: "mac",
      projects: [project("hidden", "chats"), project("Support", "project")],
      agents: [],
    };
    const before = buildCompanySidebar([{ ...sources, workspaces: [workspace("chat", "hidden")] }]);
    const after = buildCompanySidebar([{ ...sources, workspaces: [workspace("chat", "Support")] }]);
    expect(after.chats).toEqual([]);
    expect(after.projects[0].chats[0].key).toBe(before.chats[0].key);
  });
  test("pinned conversations remain available and archiving rows disappear", () => {
    const pinned = {
      ...workspace("important", "hidden"),
      pinnedAt: "2026-09-10",
      title: "Returns policy",
    };
    const archived = { ...workspace("closing", "hidden"), archivingAt: "2026-09-10" };
    const result = buildCompanySidebar([
      {
        serverId: "mac",
        projects: [project("hidden", "chats")],
        workspaces: [pinned, archived],
        agents: [],
      },
    ]);
    expect(result.pinned[0].title).toBe("Returns policy");
    expect(result.chats.map((chat) => chat.workspaceId)).toEqual(["important"]);
  });
});

describe("company conversation header", () => {
  test("uses the chat title and hides the private free-chat container", () => {
    const chat = {
      ...workspace("chat", "hidden"),
      companyKind: "chats" as const,
      name: "New chat",
    };
    expect(resolveWorkspaceHeader({ workspace: chat, agentTitle: "Returns policy" })).toEqual({
      title: "Returns policy",
      subtitle: "",
    });
  });
  test("a user name wins and a real project stays visible", () => {
    const chat = {
      ...workspace("chat", "Support"),
      companyKind: "project" as const,
      title: "Customer handbook",
    };
    expect(resolveWorkspaceHeader({ workspace: chat, agentTitle: "Generated title" })).toEqual({
      title: "Customer handbook",
      subtitle: "Support",
    });
  });
});
