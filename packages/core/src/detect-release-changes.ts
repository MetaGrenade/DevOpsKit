import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fg from "fast-glob";
import type { Workspace } from "@fdt/schemas";
import { preferWorkspaceRelativePath } from "./workspace-manager.js";

const execFileAsync = promisify(execFile);

export interface ReleaseChangeSet {
  changedResources: string[];
  changedContent: string[];
  changedZones: string[];
  changedAssets: string[];
  changedDatabaseMigrations: string[];
  sourceRef: string | null;
  detectionMethod: "git" | "manifest-hash";
}

function normalizePattern(pattern: string): string {
  return pattern.replace(/\\/g, "/");
}

async function hashFile(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

async function tryGitHead(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", cwd, "rev-parse", "HEAD"], {
      windowsHide: true,
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function tryGitChangedFiles(cwd: string, fromRef: string): Promise<string[] | null> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", cwd, "diff", "--name-only", fromRef, "HEAD"],
      { windowsHide: true },
    );
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return null;
  }
}

export async function buildWorkspaceManifest(
  workspaceRoot: string,
  workspace: Workspace,
): Promise<Record<string, string>> {
  const ignore = (workspace.resourceIgnore ?? []).map(normalizePattern);
  const resourcesRoot = path.resolve(workspaceRoot, workspace.resourcesRoot);
  const manifest: Record<string, string> = {};

  if (existsSync(resourcesRoot)) {
    const files = await fg("**/*", {
      cwd: resourcesRoot,
      onlyFiles: true,
      absolute: true,
      dot: false,
      ignore,
    });

    for (const filePath of files) {
      const relative = preferWorkspaceRelativePath(workspaceRoot, filePath);
      manifest[relative] = await hashFile(filePath);
    }
  }

  const trackedDomainFiles = [
    ".fdt/content/items.json",
    ".fdt/zones/zones.json",
  ];

  for (const relativePath of trackedDomainFiles) {
    const absolutePath = path.join(workspaceRoot, relativePath);
    if (existsSync(absolutePath)) {
      manifest[relativePath.replace(/\\/g, "/")] = await hashFile(absolutePath);
    }
  }

  return manifest;
}

function extractResourceName(changedPath: string, resourcesRootRelative: string): string | null {
  const normalized = changedPath.replace(/\\/g, "/");
  const prefix = `${resourcesRootRelative.replace(/\\/g, "/")}/`;
  if (!normalized.startsWith(prefix)) {
    return null;
  }

  const remainder = normalized.slice(prefix.length);
  const segments = remainder.split("/");
  if (segments[0]?.startsWith("[") && segments[1]) {
    return segments[1];
  }
  return segments[0] ?? null;
}

function categorizeChangedPaths(
  changedPaths: string[],
  workspaceRoot: string,
  workspace: Workspace,
  previousManifest: Record<string, string>,
  currentManifest: Record<string, string>,
): Omit<ReleaseChangeSet, "sourceRef" | "detectionMethod"> {
  const resourcesRootRelative = preferWorkspaceRelativePath(workspaceRoot, workspace.resourcesRoot);
  const changedResources = new Set<string>();
  const changedContent = new Set<string>();
  const changedZones = new Set<string>();
  const changedAssets = new Set<string>();
  const changedDatabaseMigrations = new Set<string>();

  const allPaths = new Set([...changedPaths, ...Object.keys(currentManifest)]);

  for (const changedPath of allPaths) {
    const normalized = changedPath.replace(/\\/g, "/");
    const previousHash = previousManifest[normalized];
    const currentHash = currentManifest[normalized];

    if (previousHash === currentHash) {
      continue;
    }

    if (normalized.includes("/stream/") || /\.(ytd|ydr|yft|ymap|ytyp|ybn)$/i.test(normalized)) {
      const resourceName = extractResourceName(normalized, resourcesRootRelative);
      if (resourceName) {
        changedAssets.add(resourceName);
      }
    }

    if (normalized.startsWith(".fdt/content/")) {
      changedContent.add(path.basename(normalized));
    } else if (normalized.startsWith(".fdt/zones/")) {
      changedZones.add(path.basename(normalized));
    } else if (/migrations?/i.test(normalized) || normalized.endsWith(".sql")) {
      changedDatabaseMigrations.add(normalized);
    }

    const resourceName = extractResourceName(normalized, resourcesRootRelative);
    if (resourceName) {
      changedResources.add(resourceName);
    }
  }

  return {
    changedResources: [...changedResources].sort(),
    changedContent: [...changedContent].sort(),
    changedZones: [...changedZones].sort(),
    changedAssets: [...changedAssets].sort(),
    changedDatabaseMigrations: [...changedDatabaseMigrations].sort(),
  };
}

export async function detectReleaseChanges(options: {
  workspaceRoot: string;
  workspace: Workspace;
  previousSourceRef?: string | null;
  previousManifest?: Record<string, string>;
}): Promise<ReleaseChangeSet & { currentManifest: Record<string, string> }> {
  const { workspaceRoot, workspace } = options;
  const previousManifest = options.previousManifest ?? {};
  const currentManifest = await buildWorkspaceManifest(workspaceRoot, workspace);
  const sourceRef = await tryGitHead(workspaceRoot);

  if (options.previousSourceRef && sourceRef) {
    const gitChanged = await tryGitChangedFiles(workspaceRoot, options.previousSourceRef);
    if (gitChanged) {
      const categorized = categorizeChangedPaths(
        gitChanged,
        workspaceRoot,
        workspace,
        previousManifest,
        currentManifest,
      );

      return {
        ...categorized,
        sourceRef,
        detectionMethod: "git",
        currentManifest,
      };
    }
  }

  const hashChangedPaths = Object.keys(currentManifest).filter(
    (filePath) => previousManifest[filePath] !== currentManifest[filePath],
  );

  for (const filePath of Object.keys(previousManifest)) {
    if (!(filePath in currentManifest)) {
      hashChangedPaths.push(filePath);
    }
  }

  const categorized = categorizeChangedPaths(
    hashChangedPaths,
    workspaceRoot,
    workspace,
    previousManifest,
    currentManifest,
  );

  return {
    ...categorized,
    sourceRef,
    detectionMethod: "manifest-hash",
    currentManifest,
  };
}

export async function fileExistsAndFresh(filePath: string, maxAgeMs?: number): Promise<boolean> {
  if (!existsSync(filePath)) {
    return false;
  }

  if (maxAgeMs === undefined) {
    return true;
  }

  const fileStat = await stat(filePath);
  return Date.now() - fileStat.mtimeMs <= maxAgeMs;
}
