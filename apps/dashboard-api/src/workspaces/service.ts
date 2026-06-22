import path from "node:path";
import {
  CreateWorkspaceInputSchema,
  RegisterWorkspaceInputSchema,
  WorkspaceWithConfigSchema,
  type CreateWorkspaceInput,
  type RegisterWorkspaceInput,
  type UpdateWorkspaceFrameworkInput,
  type WorkspaceRecord,
  type WorkspaceRegistry,
  type WorkspaceWithConfig,
} from "@fdt/schemas";
import {
  checkWorkspacePaths,
  createWorkspaceOnDisk,
  createWorkspaceRecord,
  detectFrameworkProfile,
  detectServerArtifactBuild,
  loadWorkspaceConfig,
  updateWorkspaceFrameworkProfile,
} from "@fdt/core";
import { loadWorkspaceRegistry, saveWorkspaceRegistry } from "./registry-store.js";
import { getMonorepoRoot, resolveFromMonorepoRoot } from "../monorepo-root.js";
import { clearAllReportCaches } from "../reports/store.js";

async function enrichWorkspaceRecord(record: WorkspaceRecord): Promise<WorkspaceWithConfig> {
  const discovery = await loadWorkspaceConfig({ workspaceRoot: record.directory });
  if (discovery.status === "not_found") {
    throw new Error(`Workspace config missing for ${record.name}: ${record.configPath}`);
  }

  const { resolvedPaths, pathChecks } = checkWorkspacePaths(record.directory, discovery.workspace);
  const serverArtifact = detectServerArtifactBuild(record.directory, discovery.workspace);
  const frameworkProfile = await detectFrameworkProfile({
    workspaceRoot: record.directory,
    workspace: discovery.workspace,
  });

  return WorkspaceWithConfigSchema.parse({
    ...record,
    workspace: discovery.workspace,
    resolvedPaths,
    pathChecks,
    serverArtifact,
    frameworkProfile,
  });
}

function setActive(registry: WorkspaceRegistry, workspaceId: string): WorkspaceRegistry {
  const exists = registry.workspaces.some((workspace) => workspace.id === workspaceId);
  if (!exists) {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }

  return {
    ...registry,
    activeWorkspaceId: workspaceId,
  };
}

async function ensureSampleWorkspace(registry: WorkspaceRegistry): Promise<WorkspaceRegistry> {
  const sampleDirectory = resolveFromMonorepoRoot(
    "resources/sample-workspaces/basic-server",
    getMonorepoRoot(),
  );

  if (!registry.workspaces.some((workspace) => workspace.directory === sampleDirectory)) {
    const discovery = await loadWorkspaceConfig({ workspaceRoot: sampleDirectory });
    if (discovery.status === "found") {
      registry = {
        ...registry,
        workspaces: [
          ...registry.workspaces,
          createWorkspaceRecord(sampleDirectory, discovery.configPath, discovery.workspace.name),
        ],
      };
    }
  }

  if (!registry.activeWorkspaceId && registry.workspaces.length > 0) {
    registry = {
      ...registry,
      activeWorkspaceId: registry.workspaces[0]!.id,
    };
  }

  return registry;
}

export async function listWorkspaces(): Promise<{
  registryPath: string;
  activeWorkspaceId: string | null;
  workspaces: WorkspaceWithConfig[];
}> {
  let registry = await loadWorkspaceRegistry();
  registry = await ensureSampleWorkspace(registry);
  await saveWorkspaceRegistry(registry);

  const workspaces = await Promise.all(registry.workspaces.map(enrichWorkspaceRecord));

  return {
    registryPath: path.dirname(path.join(getMonorepoRoot(), ".fdt")),
    activeWorkspaceId: registry.activeWorkspaceId,
    workspaces,
  };
}

export async function getActiveWorkspace(): Promise<WorkspaceWithConfig | null> {
  const { activeWorkspaceId, workspaces } = await listWorkspaces();
  if (!activeWorkspaceId) {
    return null;
  }

  return workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;
}

export async function createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceWithConfig> {
  const parsed = CreateWorkspaceInputSchema.parse(input);
  const created = await createWorkspaceOnDisk(parsed);
  const record = createWorkspaceRecord(created.directory, created.configPath, parsed.name);

  let registry = await loadWorkspaceRegistry();
  registry = {
    schemaVersion: 1,
    activeWorkspaceId: record.id,
    workspaces: [...registry.workspaces, record],
  };
  await saveWorkspaceRegistry(registry);

  return enrichWorkspaceRecord(record);
}

export async function registerExistingWorkspace(
  input: RegisterWorkspaceInput,
): Promise<WorkspaceWithConfig> {
  const parsed = RegisterWorkspaceInputSchema.parse(input);
  const directory = path.resolve(parsed.workspaceDirectory);
  const discovery = await loadWorkspaceConfig({ workspaceRoot: directory });

  if (discovery.status === "not_found") {
    throw new Error(
      `No fdt.workspace.json found in ${directory}. Create a workspace first or run fdt init there.`,
    );
  }

  let registry = await loadWorkspaceRegistry();
  const existing = registry.workspaces.find((workspace) => workspace.directory === directory);
  if (existing) {
    registry = setActive(registry, existing.id);
    await saveWorkspaceRegistry(registry);
    return enrichWorkspaceRecord(existing);
  }

  const record = createWorkspaceRecord(directory, discovery.configPath, discovery.workspace.name);
  registry = {
    ...registry,
    activeWorkspaceId: record.id,
    workspaces: [...registry.workspaces, record],
  };
  await saveWorkspaceRegistry(registry);

  return enrichWorkspaceRecord(record);
}

export async function selectWorkspace(workspaceId: string): Promise<WorkspaceWithConfig> {
  let registry = await loadWorkspaceRegistry();
  registry = setActive(registry, workspaceId);
  await saveWorkspaceRegistry(registry);
  clearAllReportCaches();

  const record = registry.workspaces.find((workspace) => workspace.id === workspaceId);
  if (!record) {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }

  return enrichWorkspaceRecord(record);
}

export async function removeWorkspace(workspaceId: string): Promise<void> {
  const registry = await loadWorkspaceRegistry();
  const nextWorkspaces = registry.workspaces.filter((workspace) => workspace.id !== workspaceId);

  if (nextWorkspaces.length === registry.workspaces.length) {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }

  const nextActive =
    registry.activeWorkspaceId === workspaceId
      ? (nextWorkspaces[0]?.id ?? null)
      : registry.activeWorkspaceId;

  await saveWorkspaceRegistry({
    schemaVersion: 1,
    activeWorkspaceId: nextActive,
    workspaces: nextWorkspaces,
  });
}

export async function getActiveWorkspaceDirectory(): Promise<string | null> {
  const active = await getActiveWorkspace();
  return active?.directory ?? null;
}

export async function updateActiveWorkspaceFramework(
  input: UpdateWorkspaceFrameworkInput,
): Promise<WorkspaceWithConfig> {
  const registry = await loadWorkspaceRegistry();
  if (!registry.activeWorkspaceId) {
    throw new Error("No active workspace selected.");
  }

  const record = registry.workspaces.find((workspace) => workspace.id === registry.activeWorkspaceId);
  if (!record) {
    throw new Error("Active workspace record not found.");
  }

  await updateWorkspaceFrameworkProfile(record.directory, record.configPath, input);
  return enrichWorkspaceRecord(record);
}
