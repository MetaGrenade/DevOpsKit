import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import type { Vehicle, VehicleFiles } from "@fdt/schemas";
import { VehicleSchema } from "@fdt/schemas";
import { discoverResourceNames } from "./detect-framework.js";
import { resolveResourceDirectory } from "./resource-path.js";
import { extractHandlingBlock, parseHandlingMeta, parseVehicleDisplayName, parseVehicleModelNames } from "./handling-meta.js";
import { upsertVehicle } from "./vehicle-store.js";

const META_CANDIDATES = {
  vehiclesMeta: ["vehicles.meta", "data/vehicles.meta", "stream/vehicles.meta"],
  handlingMeta: ["handling.meta", "data/handling.meta"],
  carcolsMeta: ["carcols.meta", "data/carcols.meta"],
  carvariationsMeta: ["carvariations.meta", "data/carvariations.meta"],
};

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function isLikelyVehicleResource(resourceName: string): boolean {
  return /vehicle|vehicles|car|cars|fleet|garage|pack|addon/i.test(resourceName);
}

function findFirstExisting(resourceRoot: string, candidates: string[]): string | undefined {
  for (const candidate of candidates) {
    const fullPath = path.join(resourceRoot, candidate);
    if (existsSync(fullPath)) {
      return normalizePath(candidate);
    }
  }
  return undefined;
}

async function indexStreamFiles(resourceRoot: string): Promise<{ yft: string[]; ytd: string[] }> {
  const files = await fg(["stream/**/*.{yft,ytd}"], {
    cwd: resourceRoot,
    onlyFiles: true,
    dot: false,
  });

  const yft: string[] = [];
  const ytd: string[] = [];
  for (const file of files.sort()) {
    const normalized = normalizePath(file);
    if (normalized.endsWith(".yft")) {
      yft.push(path.basename(normalized));
    }
    if (normalized.endsWith(".ytd")) {
      ytd.push(path.basename(normalized));
    }
  }

  return { yft, ytd };
}

export interface ScanVehicleResourceResult {
  resourceName: string;
  resourcePath: string;
  spawnNames: string[];
  files: VehicleFiles;
  vehicles: Vehicle[];
}

export async function scanVehicleResource(options: {
  workspaceRoot: string;
  resourceName: string;
  resourcesRoot: string;
}): Promise<ScanVehicleResourceResult | null> {
  const resolved = resolveResourceDirectory(options.workspaceRoot, options.resourcesRoot, options.resourceName);
  if (!resolved) {
    return null;
  }

  const { resourceRoot, resourcePath } = resolved;

  const files: VehicleFiles = {
    yft: [],
    ytd: [],
    vehiclesMeta: findFirstExisting(resourceRoot, META_CANDIDATES.vehiclesMeta),
    handlingMeta: findFirstExisting(resourceRoot, META_CANDIDATES.handlingMeta),
    carcolsMeta: findFirstExisting(resourceRoot, META_CANDIDATES.carcolsMeta),
    carvariationsMeta: findFirstExisting(resourceRoot, META_CANDIDATES.carvariationsMeta),
  };

  const streamFiles = await indexStreamFiles(resourceRoot);
  files.yft = streamFiles.yft;
  files.ytd = streamFiles.ytd;

  let spawnNames: string[] = [];
  let vehiclesMetaContent = "";

  if (files.vehiclesMeta) {
    vehiclesMetaContent = await readFile(path.join(resourceRoot, files.vehiclesMeta), "utf8");
    spawnNames = parseVehicleModelNames(vehiclesMetaContent);
  }

  if (spawnNames.length === 0) {
    spawnNames = streamFiles.yft
      .map((file) => file.replace(/\.yft$/i, "").toLowerCase())
      .filter(Boolean)
      .sort();
  }

  const vehicles: Vehicle[] = spawnNames.map((spawnName) => {
    const displayName =
      (vehiclesMetaContent ? parseVehicleDisplayName(vehiclesMetaContent, spawnName) : undefined) ??
      titleCase(spawnName);
    const emergency = /police|ambulance|fire|ems|sheriff|cvpi|charger|explorer/i.test(spawnName);

    return VehicleSchema.parse({
      spawnName,
      displayName,
      category: emergency ? "emergency" : "car",
      emergency,
      files,
      metadata: {
        resourceName: options.resourceName,
        resourcePath,
        lastScannedAt: new Date().toISOString(),
      },
    });
  });

  return {
    resourceName: options.resourceName,
    resourcePath,
    spawnNames,
    files,
    vehicles,
  };
}

export interface ScanWorkspaceVehiclesOptions {
  workspaceRoot: string;
  resourcesRoot: string;
  discover?: boolean;
  resourceName?: string;
}

export async function scanWorkspaceVehicles(options: ScanWorkspaceVehiclesOptions): Promise<ScanVehicleResourceResult[]> {
  const resourcesRoot = path.resolve(options.workspaceRoot, options.resourcesRoot);
  let resourceNames = options.resourceName
    ? [options.resourceName]
    : [...discoverResourceNames(resourcesRoot)].filter((name) => isLikelyVehicleResource(name));

  if (options.discover !== false && !options.resourceName) {
    for (const name of discoverResourceNames(resourcesRoot)) {
      const resourceRoot = path.join(resourcesRoot, name);
      const hasMeta =
        META_CANDIDATES.vehiclesMeta.some((candidate) => existsSync(path.join(resourceRoot, candidate))) ||
        existsSync(path.join(resourceRoot, "stream"));
      if (hasMeta && !resourceNames.includes(name)) {
        resourceNames.push(name);
      }
    }
  }

  resourceNames = [...new Set(resourceNames)].sort();
  const results: ScanVehicleResourceResult[] = [];

  for (const resourceName of resourceNames) {
    const scanned = await scanVehicleResource({
      workspaceRoot: options.workspaceRoot,
      resourceName,
      resourcesRoot: options.resourcesRoot,
    });
    if (!scanned) {
      continue;
    }

    for (const vehicle of scanned.vehicles) {
      await upsertVehicle(options.workspaceRoot, vehicle);
    }

    results.push(scanned);
  }

  return results;
}

export async function loadHandlingMetricsForSpawn(
  workspaceRoot: string,
  resourcesRoot: string,
  spawnName: string,
): Promise<import("@fdt/schemas").VehicleHandlingMetrics | null> {
  const resources = path.resolve(workspaceRoot, resourcesRoot);

  for (const resourceName of discoverResourceNames(resources)) {
    const resolved = resolveResourceDirectory(workspaceRoot, resourcesRoot, resourceName);
    if (!resolved) {
      continue;
    }

    const handlingMeta = findFirstExisting(resolved.resourceRoot, META_CANDIDATES.handlingMeta);
    if (!handlingMeta) {
      continue;
    }

    const content = await readFile(path.join(resolved.resourceRoot, handlingMeta), "utf8");
    const block = extractHandlingBlock(content, spawnName);
    if (!block) {
      continue;
    }

    return parseHandlingMeta(block, spawnName, resourceName);
  }

  return null;
}
