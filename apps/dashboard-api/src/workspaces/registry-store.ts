import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { WorkspaceRegistrySchema, type WorkspaceRegistry } from "@fdt/schemas";
import { getMonorepoRoot } from "../monorepo-root.js";

const REGISTRY_DIR = "dashboard";
const REGISTRY_FILENAME = "workspaces-registry.json";

function getRegistryPath(): string {
  const dataDir = process.env.FDT_DATA_DIR
    ? path.resolve(process.env.FDT_DATA_DIR)
    : path.join(getMonorepoRoot(), ".fdt", REGISTRY_DIR);

  return path.join(dataDir, REGISTRY_FILENAME);
}

function emptyRegistry(): WorkspaceRegistry {
  return {
    schemaVersion: 1,
    activeWorkspaceId: null,
    workspaces: [],
  };
}

export async function loadWorkspaceRegistry(): Promise<WorkspaceRegistry> {
  const registryPath = getRegistryPath();

  if (!existsSync(registryPath)) {
    return emptyRegistry();
  }

  const raw = await readFile(registryPath, "utf8");
  return WorkspaceRegistrySchema.parse(JSON.parse(raw));
}

export async function saveWorkspaceRegistry(registry: WorkspaceRegistry): Promise<string> {
  const registryPath = getRegistryPath();
  await mkdir(path.dirname(registryPath), { recursive: true });
  await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  return registryPath;
}

export function getWorkspaceRegistryPath(): string {
  return getRegistryPath();
}
