import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import type { Resource, Workspace } from "@fdt/schemas";
import { emptyMissingManifest, parseFxManifest } from "./parse-fxmanifest.js";
import { allStartedResources, loadServerCfg, parseServerCfg } from "./parse-server-cfg.js";

export interface ScanResourcesOptions {
  workspaceRoot: string;
  workspace: Workspace;
}

export interface ScanResourcesResult {
  resources: Resource[];
  serverCfg: ReturnType<typeof parseServerCfg>;
  resourceNames: Map<string, Resource[]>;
}

const MANIFEST_FILES = [
  { filename: "fxmanifest.lua", type: "fxmanifest" as const },
  { filename: "__resource.lua", type: "legacy_resource" as const },
];

async function isDirectory(target: string): Promise<boolean> {
  try {
    return (await stat(target)).isDirectory();
  } catch {
    return false;
  }
}

function normalizeGlobPattern(pattern: string): string {
  return pattern.replace(/\\/g, "/");
}

async function discoverResourceRoots(resourcesRoot: string, ignore: string[]): Promise<string[]> {
  const normalizedIgnore = ignore.map(normalizeGlobPattern);
  const entries = await fg("**/*", {
    cwd: resourcesRoot,
    onlyDirectories: true,
    absolute: true,
    dot: false,
    ignore: normalizedIgnore,
  });

  const roots = new Set<string>();

  for (const dir of entries) {
    for (const manifest of MANIFEST_FILES) {
      if (existsSync(path.join(dir, manifest.filename))) {
        roots.add(dir);
        break;
      }
    }
  }

  for (const manifest of MANIFEST_FILES) {
    if (existsSync(path.join(resourcesRoot, manifest.filename))) {
      roots.add(resourcesRoot);
    }
  }

  // Include category child folders that look like resources but lack a manifest.
  const categoryDirs = await fg("[[]*[]]/*", {
    cwd: resourcesRoot,
    onlyDirectories: true,
    absolute: true,
    dot: false,
    ignore: normalizedIgnore,
  });

  for (const dir of categoryDirs) {
    const hasManifest = MANIFEST_FILES.some((manifest) =>
      existsSync(path.join(dir, manifest.filename)),
    );
    if (!hasManifest) {
      roots.add(dir);
    }
  }

  const sorted = [...roots].sort((a, b) => a.length - b.length);
  const minimal: string[] = [];

  for (const root of sorted) {
    if (!minimal.some((existing) => root.startsWith(existing + path.sep))) {
      minimal.push(root);
    }
  }

  return minimal;
}

function deriveResourceName(resourcePath: string, resourcesRoot: string): {
  name: string;
  category?: string;
} {
  const relative = path.relative(resourcesRoot, resourcePath);
  const parts = relative.split(path.sep);
  const name = parts[parts.length - 1] ?? relative;

  if (parts.length >= 2 && parts[0]!.startsWith("[") && parts[0]!.endsWith("]")) {
    return { name, category: parts[0]!.slice(1, -1) };
  }

  return { name, category: parts.length > 1 ? parts[0] : undefined };
}

async function readManifest(resourcePath: string): Promise<Resource["manifest"]> {
  for (const manifest of MANIFEST_FILES) {
    const manifestPath = path.join(resourcePath, manifest.filename);
    if (existsSync(manifestPath)) {
      const raw = await readFile(manifestPath, "utf8");
      return parseFxManifest(raw, manifest.type);
    }
  }

  return emptyMissingManifest();
}

async function findStreamAssets(resourcePath: string): Promise<string[]> {
  const streamDir = path.join(resourcePath, "stream");
  if (!(await isDirectory(streamDir))) {
    return [];
  }

  const files = await fg("**/*", {
    cwd: streamDir,
    onlyFiles: true,
    absolute: false,
  });

  return files.map((file) => path.join("stream", file));
}

export async function scanResources(options: ScanResourcesOptions): Promise<ScanResourcesResult> {
  const { workspaceRoot, workspace } = options;
  const resourcesRoot = path.resolve(workspaceRoot, workspace.resourcesRoot);
  const serverCfgPath = path.resolve(workspaceRoot, workspace.serverCfg);

  if (!(await isDirectory(resourcesRoot))) {
    throw new Error(`Resources root not found: ${resourcesRoot}`);
  }

  const resourceRoots = await discoverResourceRoots(resourcesRoot, workspace.resourceIgnore);
  const resources: Resource[] = [];

  for (const resourcePath of resourceRoots) {
    const { name, category } = deriveResourceName(resourcePath, resourcesRoot);
    const manifest = await readManifest(resourcePath);
    const streamAssets = await findStreamAssets(resourcePath);

    resources.push({
      name,
      path: path.relative(workspaceRoot, resourcePath).replace(/\\/g, "/"),
      category,
      manifest,
      exports: [],
      events: [],
      streamAssets,
      warnings: [],
      errors: [],
    });
  }

  resources.sort((a, b) => a.name.localeCompare(b.name));

  const resourceNames = new Map<string, Resource[]>();
  for (const resource of resources) {
    const existing = resourceNames.get(resource.name) ?? [];
    existing.push(resource);
    resourceNames.set(resource.name, existing);
  }

  const serverCfgRelative = path.relative(workspaceRoot, serverCfgPath).replace(/\\/g, "/");
  const resourcePathByName = new Map(resources.map((resource) => [resource.name, resource.path]));

  let serverCfg = parseServerCfg("", serverCfgRelative);
  if (existsSync(serverCfgPath)) {
    serverCfg = await loadServerCfg(serverCfgPath, {
      workspaceRoot,
      resourcesRoot,
      serverDataRoot: path.dirname(serverCfgPath),
      resources: resources.map((resource) => ({ name: resource.name, path: resource.path })),
      resolveResourcePath: (name) => resourcePathByName.get(name),
    });
  }

  return { resources, serverCfg, resourceNames };
}

export { allStartedResources };
