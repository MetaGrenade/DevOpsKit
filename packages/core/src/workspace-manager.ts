import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  WorkspaceSchema,
  type CreateWorkspaceInput,
  type Workspace,
} from "@fdt/schemas";
import { FDT_EXPORTS_DIR, FDT_REPORTS_DIR } from "./workspace.js";

export interface CreatedWorkspaceResult {
  directory: string;
  configPath: string;
  workspace: Workspace;
}

export function resolveWorkspacePath(workspaceRoot: string, targetPath: string): string {
  return path.resolve(workspaceRoot, targetPath);
}

export function preferWorkspaceRelativePath(workspaceRoot: string, targetPath: string): string {
  const resolved = path.resolve(workspaceRoot, targetPath);
  const relative = path.relative(workspaceRoot, resolved);

  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    return relative.split(path.sep).join("/");
  }

  return resolved.split(path.sep).join("/");
}

export function resolveWorkspacePaths(workspaceRoot: string, workspace: Workspace) {
  return {
    serverRoot: resolveWorkspacePath(workspaceRoot, workspace.serverRoot),
    resourcesRoot: resolveWorkspacePath(workspaceRoot, workspace.resourcesRoot),
    serverCfg: resolveWorkspacePath(workspaceRoot, workspace.serverCfg),
    artifactOutput: resolveWorkspacePath(workspaceRoot, workspace.artifactOutput),
    reportPath: resolveWorkspacePath(workspaceRoot, `${FDT_REPORTS_DIR}/resource-doctor.json`),
  };
}

export function checkWorkspacePaths(workspaceRoot: string, workspace: Workspace) {
  const resolved = resolveWorkspacePaths(workspaceRoot, workspace);

  return {
    resolvedPaths: resolved,
    pathChecks: {
      workspaceDirectory: existsSync(workspaceRoot),
      serverRoot: existsSync(resolved.serverRoot),
      resourcesRoot: existsSync(resolved.resourcesRoot),
      serverCfg: existsSync(resolved.serverCfg),
    },
  };
}

export async function createWorkspaceOnDisk(
  input: CreateWorkspaceInput,
): Promise<CreatedWorkspaceResult> {
  const directory = path.resolve(input.workspaceDirectory);
  const configPath = path.join(directory, "fdt.workspace.json");

  if (existsSync(configPath)) {
    throw new Error(`Workspace config already exists: ${configPath}`);
  }

  const workspace = WorkspaceSchema.parse({
    schemaVersion: 1,
    name: input.name,
    serverRoot: preferWorkspaceRelativePath(directory, input.serverRoot),
    resourcesRoot: preferWorkspaceRelativePath(directory, input.resourcesRoot),
    serverCfg: preferWorkspaceRelativePath(directory, input.serverCfg),
    artifactOutput: "./.fdt/exports",
    frameworkTargets: input.frameworkTargets,
    rulesets: ["baseline", "performance", "security", "asset-streaming"],
    resourceIgnore: ["**/.git/**", "**/node_modules/**", "**/dist/**", "**/cache/**"],
  });

  await mkdir(path.join(directory, ".fdt", "reports"), { recursive: true });
  await mkdir(path.join(directory, FDT_EXPORTS_DIR), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(workspace, null, 2)}\n`, "utf8");

  return { directory, configPath, workspace };
}

export function createWorkspaceRecord(
  directory: string,
  configPath: string,
  name: string,
): {
  id: string;
  name: string;
  directory: string;
  configPath: string;
  createdAt: string;
  updatedAt: string;
} {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    name,
    directory: path.resolve(directory),
    configPath: path.resolve(configPath),
    createdAt: now,
    updatedAt: now,
  };
}
