import { writeFile } from "node:fs/promises";
import {
  UpdateWorkspaceFrameworkInputSchema,
  WorkspaceSchema,
  type FrameworkTarget,
  type UpdateWorkspaceFrameworkInput,
  type Workspace,
} from "@fdt/schemas";
import { loadWorkspaceConfig } from "./workspace.js";

export async function updateWorkspaceFrameworkProfile(
  workspaceRoot: string,
  configPath: string,
  input: UpdateWorkspaceFrameworkInput,
): Promise<Workspace> {
  const parsed = UpdateWorkspaceFrameworkInputSchema.parse(input);
  const discovery = await loadWorkspaceConfig({ workspaceRoot, configPath });

  if (discovery.status === "not_found") {
    throw new Error(`Workspace config not found: ${configPath}`);
  }

  const current = discovery.workspace;
  let frameworkProfile = { ...current.frameworkProfile };

  if (parsed.clearManualOverride) {
    frameworkProfile = {};
  } else {
    if (parsed.framework !== undefined) {
      frameworkProfile.framework = parsed.framework;
    }
    if (parsed.inventory !== undefined) {
      frameworkProfile.inventory = parsed.inventory;
    }
  }

  const hasOverride =
    frameworkProfile.framework !== undefined || frameworkProfile.inventory !== undefined;

  const nextWorkspace = WorkspaceSchema.parse({
    ...current,
    frameworkProfile: hasOverride ? frameworkProfile : undefined,
    frameworkTargets: hasOverride
      ? uniqueFrameworkTargets(current.frameworkTargets, frameworkProfile.framework)
      : current.frameworkTargets,
  });

  await writeFile(configPath, `${JSON.stringify(nextWorkspace, null, 2)}\n`, "utf8");
  return nextWorkspace;
}

function uniqueFrameworkTargets(
  existing: Workspace["frameworkTargets"],
  framework?: FrameworkTarget,
): Workspace["frameworkTargets"] {
  const targets = new Set(existing);
  if (framework && framework !== "custom") {
    targets.add(framework);
  }
  if (!targets.size) {
    targets.add("custom");
  }
  return [...targets];
}
