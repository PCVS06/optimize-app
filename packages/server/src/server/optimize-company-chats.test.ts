import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createTestLogger } from "../test-utils/test-logger.js";
import {
  createCompanyChat,
  createCompanyProject,
  moveCompanyChat,
} from "./optimize-company-chats.js";
import {
  FileBackedProjectRegistry,
  FileBackedWorkspaceRegistry,
  createPersistedProjectRecord,
} from "./workspace-registry.js";

let paseoHome: string;
let projects: FileBackedProjectRegistry;
let workspaces: FileBackedWorkspaceRegistry;
function stores() {
  return { paseoHome, projects, workspaces };
}
async function openStores() {
  projects = new FileBackedProjectRegistry(
    path.join(paseoHome, "projects", "projects.json"),
    createTestLogger(),
  );
  workspaces = new FileBackedWorkspaceRegistry(
    path.join(paseoHome, "projects", "workspaces.json"),
    createTestLogger(),
  );
  await Promise.all([projects.initialize(), workspaces.initialize()]);
}
beforeEach(async () => {
  paseoHome = await mkdtemp(path.join(os.tmpdir(), "optimize-company-"));
  await openStores();
});
afterEach(async () => {
  await rm(paseoHome, { recursive: true, force: true });
});

describe("company chats and projects", () => {
  test("creates a named project without treating its name as a filesystem path", async () => {
    const project = await createCompanyProject(stores(), "  Sales / Support  ");
    expect(project.companyKind).toBe("project");
    expect(project.customName).toBe("Sales / Support");
    expect(project.rootPath.startsWith(path.join(paseoHome, "company", "projects"))).toBe(true);
    expect(project.rootPath).not.toContain("Sales");
    expect((await stat(project.rootPath)).isDirectory()).toBe(true);
    expect(await workspaces.list()).toEqual([]);
    await openStores();
    expect(await projects.get(project.projectId)).toEqual(project);
  });
  test("concurrent free chats have one hidden container and independent persistent identities", async () => {
    const created = await Promise.all(Array.from({ length: 6 }, () => createCompanyChat(stores())));
    expect(new Set(created.map((entry) => entry.project.projectId)).size).toBe(1);
    expect(new Set(created.map((entry) => entry.workspace.workspaceId)).size).toBe(6);
    expect(new Set(created.map((entry) => entry.workspace.cwd)).size).toBe(6);
    expect(created[0].project.companyKind).toBe("chats");
    await openStores();
    expect((await projects.list()).length).toBe(1);
    expect((await workspaces.list()).length).toBe(6);
    expect((await projects.get(created[0].project.projectId))?.companyKind).toBe("chats");
  });
  test("moves a chat into and outside a project without changing its history identity or runtime directory", async () => {
    const created = await createCompanyChat(stores());
    const destination = await createCompanyProject(stores(), "Service");
    const moved = await moveCompanyChat(
      stores(),
      created.workspace.workspaceId,
      destination.projectId,
    );
    expect(moved.workspace.projectId).toBe(destination.projectId);
    expect(moved.workspace.workspaceId).toBe(created.workspace.workspaceId);
    expect(moved.workspace.cwd).toBe(created.workspace.cwd);
    await openStores();
    expect((await workspaces.get(created.workspace.workspaceId))?.projectId).toBe(
      destination.projectId,
    );
    const outside = await moveCompanyChat(stores(), created.workspace.workspaceId);
    expect(outside.project.companyKind).toBe("chats");
    expect(outside.workspace.cwd).toBe(created.workspace.cwd);
    expect(outside.workspace.workspaceId).toBe(created.workspace.workspaceId);
  });
  test("preserves legacy projects and creates only private runtime directories for new chats", async () => {
    const legacy = createPersistedProjectRecord({
      projectId: "remote:github.com/acme/repo",
      rootPath: "/legacy/customer-files",
      kind: "git",
      displayName: "Legacy",
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
    });
    await projects.upsert(legacy);
    const created = await createCompanyChat(stores(), legacy.projectId);
    expect(created.workspace.projectId).toBe(legacy.projectId);
    expect(created.workspace.cwd.startsWith(path.join(paseoHome, "company", "runtime"))).toBe(true);
    expect(await projects.get(legacy.projectId)).toEqual(legacy);
    expect(await readFile(path.join(paseoHome, "projects", "projects.json"), "utf8")).toContain(
      "/legacy/customer-files",
    );
  });
  test("rejects missing or archived targets without changing the existing chat", async () => {
    const created = await createCompanyChat(stores());
    const destination = await createCompanyProject(stores(), "Closed");
    await projects.archive(destination.projectId, "2026-09-10");
    await expect(createCompanyChat(stores(), "missing")).rejects.toThrow("no longer available");
    await expect(
      moveCompanyChat(stores(), created.workspace.workspaceId, destination.projectId),
    ).rejects.toThrow("no longer available");
    expect(await workspaces.get(created.workspace.workspaceId)).toEqual(created.workspace);
  });
  test("rejects blank and oversized names before saving a project", async () => {
    await expect(createCompanyProject(stores(), "   ")).rejects.toThrow("project name");
    await expect(createCompanyProject(stores(), "x".repeat(121))).rejects.toThrow("project name");
    expect(await projects.list()).toEqual([]);
  });
});
