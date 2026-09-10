import { mkdir, rmdir } from "node:fs/promises";
import path from "node:path";
import {
  createPersistedWorkspaceRecord,
  type ProjectRegistry,
  type WorkspaceRegistry,
  type PersistedProjectRecord,
} from "./workspace-registry.js";
import { generateProjectId, generateWorkspaceId } from "./workspace-registry-model.js";

interface CompanyStores {
  paseoHome: string;
  projects: ProjectRegistry;
  workspaces: WorkspaceRegistry;
}

/** Company projects are names and context. Private runtime folders are never chosen by staff. */
export async function createCompanyProject(stores: CompanyStores, rawName: string) {
  const name = rawName.trim();
  if (
    !name ||
    name.length > 120 ||
    Array.from(name).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  ) {
    throw new Error("Enter a project name between 1 and 120 characters.");
  }
  const rootPath = path.join(stores.paseoHome, "company", "projects", generateProjectId());
  await mkdir(rootPath, { recursive: true, mode: 0o700 });
  try {
    return await registerCompanyProject(stores, rootPath, name, "project");
  } catch (error) {
    // Remove only the empty folder allocated here; never recursively delete data after failure.
    await rmdir(rootPath).catch(() => undefined);
    throw error;
  }
}

async function registerCompanyProject(
  stores: CompanyStores,
  rootPath: string,
  name: string,
  companyKind: "project" | "chats",
): Promise<PersistedProjectRecord> {
  const timestamp = new Date().toISOString();
  // Allocation is serialized by the shared registry, including requests from different clients.
  const project = await stores.projects.getOrCreateActiveByRoot({
    rootPath,
    kind: "non_git",
    displayName: name,
    timestamp,
  });
  const updated = await stores.projects.update(project.projectId, (current) => ({
    ...current,
    companyKind,
    customName: current.customName ?? name,
    updatedAt: timestamp,
  }));
  if (!updated) throw new Error("The project could not be saved. Please try again.");
  return updated;
}

export async function createCompanyChat(stores: CompanyStores, projectId?: string) {
  let project: PersistedProjectRecord | null;
  if (projectId) {
    project = await stores.projects.get(projectId);
    if (!project || project.archivedAt) throw new Error("This project is no longer available.");
  } else {
    project = await getFreeChatProject(stores);
  }
  const workspaceId = generateWorkspaceId();
  // Legacy IDs can contain path separators. Encode them before using an ID as a directory name.
  const cwd = path.join(
    stores.paseoHome,
    "company",
    "runtime",
    encodeURIComponent(project.projectId),
    workspaceId,
  );
  await mkdir(cwd, { recursive: true, mode: 0o700 });
  const timestamp = new Date().toISOString();
  const workspace = createPersistedWorkspaceRecord({
    workspaceId,
    projectId: project.projectId,
    cwd,
    kind: "directory",
    displayName: "New chat",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  try {
    await stores.workspaces.upsert(workspace);
  } catch (error) {
    await rmdir(cwd).catch(() => undefined);
    throw error;
  }
  return { project, workspace };
}

async function getFreeChatProject(stores: CompanyStores) {
  const rootPath = path.join(stores.paseoHome, "company", "chats");
  await mkdir(rootPath, { recursive: true, mode: 0o700 });
  return registerCompanyProject(stores, rootPath, "Chats", "chats");
}

export async function moveCompanyChat(
  stores: CompanyStores,
  workspaceId: string,
  projectId?: string,
) {
  const workspace = await stores.workspaces.get(workspaceId);
  if (!workspace || workspace.archivedAt) throw new Error("This chat is no longer available.");
  const project = projectId
    ? await stores.projects.get(projectId)
    : await getFreeChatProject(stores);
  if (!project || project.archivedAt) throw new Error("This project is no longer available.");
  const moved = await stores.workspaces.update(workspaceId, (current) => ({
    ...current,
    projectId: project.projectId,
    updatedAt: new Date().toISOString(),
  }));
  if (!moved) throw new Error("This chat is no longer available.");
  return { project, workspace: moved };
}
