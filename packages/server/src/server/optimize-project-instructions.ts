import type { ProjectRegistry, WorkspaceRegistry } from "./workspace-registry.js";
import { readPaseoConfigForEdit } from "../utils/paseo-config-file.js";

interface ProjectInstructionsInput {
  workspaceId: string | undefined;
  projects: Pick<ProjectRegistry, "get">;
  workspaces: Pick<WorkspaceRegistry, "get">;
}

export class ProjectInstructionsReadError extends Error {
  constructor(readonly projectId: string) {
    super("Project instructions could not be read. Check this project's settings.");
    this.name = "ProjectInstructionsReadError";
  }
}

/** Ownership comes from registry IDs, never from an ancestor-directory search. */
export async function readOptimizeProjectInstructions({
  workspaceId,
  projects,
  workspaces,
}: ProjectInstructionsInput): Promise<string | undefined> {
  if (!workspaceId) return undefined;
  const workspace = await workspaces.get(workspaceId);
  if (!workspace) return undefined;
  const project = await projects.get(workspace.projectId);
  if (!project || project.archivedAt) return undefined;
  const result = readPaseoConfigForEdit(project.rootPath);
  if (!result.ok) {
    throw new ProjectInstructionsReadError(project.projectId);
  }
  return result.config?.systemPrompt;
}

interface InstructionLayers {
  company: string;
  project?: string;
  profile?: string;
  memory?: string;
}

export function composeOptimizeInstructions({
  company,
  project,
  profile,
  memory,
}: InstructionLayers): string {
  return [
    company.trim(),
    project?.trim()
      ? "Project instructions\nApply these to this project, subject to the company-wide instructions above.\n" +
        project.trim()
      : undefined,
    profile?.trim()
      ? "Assistant system prompt\nApply this role subject to company and project instructions above.\n" +
        profile.trim()
      : undefined,
    memory,
  ]
    .filter(Boolean)
    .join("\n\n");
}
