import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { createTestLogger } from "../test-utils/test-logger.js";
import {
  createPersistedWorkspaceRecord,
  FileBackedProjectRegistry,
  FileBackedWorkspaceRegistry,
} from "./workspace-registry.js";
import {
  composeOptimizeInstructions,
  readOptimizeProjectInstructions,
} from "./optimize-project-instructions.js";

let root: string;
let projects: FileBackedProjectRegistry;
let workspaces: FileBackedWorkspaceRegistry;
let projectId: string;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "optimize-instructions-"));
  const logger = createTestLogger();
  projects = new FileBackedProjectRegistry(join(root, "projects.json"), logger);
  workspaces = new FileBackedWorkspaceRegistry(join(root, "workspaces.json"), logger);
  await projects.initialize();
  await workspaces.initialize();
  mkdirSync(join(root, "project"));
  mkdirSync(join(root, "separate-workspace"));
  const timestamp = "2026-09-10T12:00:00.000Z";
  const project = await projects.getOrCreateActiveByRoot({
    rootPath: join(root, "project"),
    kind: "non_git",
    displayName: "Support",
    timestamp,
  });
  projectId = project.projectId;
  await workspaces.upsert(
    createPersistedWorkspaceRecord({
      workspaceId: "support-chat",
      projectId,
      cwd: join(root, "separate-workspace"),
      kind: "directory",
      displayName: "Returns",
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
  );
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

test("reads the registered project's instructions and observes edits, never workspace or ancestor overrides", async () => {
  writeFileSync(join(root, "paseo.json"), JSON.stringify({ systemPrompt: "Wrong ancestor" }));
  writeFileSync(
    join(root, "separate-workspace", "paseo.json"),
    JSON.stringify({ systemPrompt: "Wrong workspace" }),
  );
  const projectFile = join(root, "project", "paseo.json");
  writeFileSync(projectFile, JSON.stringify({ systemPrompt: "Use the return policy." }));
  expect(
    await readOptimizeProjectInstructions({ workspaceId: "support-chat", projects, workspaces }),
  ).toBe("Use the return policy.");
  writeFileSync(projectFile, JSON.stringify({ systemPrompt: "Use the updated policy." }));
  expect(
    await readOptimizeProjectInstructions({ workspaceId: "support-chat", projects, workspaces }),
  ).toBe("Use the updated policy.");
  expect(
    await readOptimizeProjectInstructions({ workspaceId: undefined, projects, workspaces }),
  ).toBeUndefined();
  expect(
    await readOptimizeProjectInstructions({ workspaceId: "unrelated-chat", projects, workspaces }),
  ).toBeUndefined();
  await projects.archive(projectId, "2026-09-10T12:00:00.000Z");
  expect(
    await readOptimizeProjectInstructions({ workspaceId: "support-chat", projects, workspaces }),
  ).toBeUndefined();
});

test("missing instructions inherit company defaults; invalid configuration is reported", async () => {
  expect(
    await readOptimizeProjectInstructions({ workspaceId: "support-chat", projects, workspaces }),
  ).toBeUndefined();
  writeFileSync(join(root, "project", "paseo.json"), "{broken");
  await expect(
    readOptimizeProjectInstructions({ workspaceId: "support-chat", projects, workspaces }),
  ).rejects.toThrow("Project instructions could not be read");
});

test("project instructions supplement company instructions and empty prompts do not erase them", () => {
  expect(composeOptimizeInstructions({ company: " Company rules. ", project: "" })).toBe(
    "Company rules.",
  );
  const combined = composeOptimizeInstructions({
    company: "Company rules.",
    project: "Project rules.",
  });
  expect(combined).toMatch(/^Company rules\./);
  expect(combined).toContain("subject to the company-wide instructions above");
  expect(combined).toMatch(/Project rules\.$/);
  expect(composeOptimizeInstructions({ company: "" })).toBe("");
});

test("layers profile instructions below company and project rules and keeps memory separate", () => {
  const prompt = composeOptimizeInstructions({
    company: "Company rule",
    project: "Project rule",
    profile: "Support assistant rule",
    memory: "Saved memory: factual context",
  });
  expect(prompt.indexOf("Company rule")).toBeLessThan(prompt.indexOf("Project rule"));
  expect(prompt.indexOf("Project rule")).toBeLessThan(prompt.indexOf("Support assistant rule"));
  expect(prompt.indexOf("Support assistant rule")).toBeLessThan(prompt.indexOf("Saved memory"));
  expect(prompt).toContain("subject to company and project instructions");
});
