import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import { parseFxManifest } from "@fdt/scanner";
import type { MapStreamCounts, ZoneCoord, MapPackage } from "@fdt/schemas";
import { MapStreamCountsSchema, MapPackageSchema } from "@fdt/schemas";
import { discoverResourceNames } from "./detect-framework.js";
import { resolveResourceDirectory } from "./resource-path.js";
import { isLikelyVehicleResource } from "./scan-vehicle-resource.js";
import {
  createDefaultMapChecklist,
  deriveMapStatus,
  deriveMapIdFromResourceName,
  ensureUniqueMapId,
  evaluateMapChecklist,
  listMapPackages,
  sanitizeMapId,
  upsertMapPackage,
} from "./map-store.js";

const MAP_EXTENSIONS = new Set(["ymap", "ytyp", "ybn", "ydr", "ytd"]);
const VEHICLE_META_CANDIDATES = ["vehicles.meta", "data/vehicles.meta", "stream/vehicles.meta"];

export function isLikelyMapResource(resourceName: string): boolean {
  const normalized = resourceName.toLowerCase();
  return /(?:^|[_-])(map|mlo|interior|ipl)(?:[_-]|$)/.test(normalized)
    || /(?:map|mlo|interior|ipl)/.test(normalized);
}

export function hasCoreMapAssets(streamCounts: MapStreamCounts): boolean {
  return streamCounts.ymap > 0 || streamCounts.ytyp > 0 || streamCounts.ybn > 0;
}

function hasVehicleMeta(resourceRoot: string): boolean {
  return VEHICLE_META_CANDIDATES.some((candidate) => existsSync(path.join(resourceRoot, candidate)));
}

function hasStreamYft(resourceRoot: string): Promise<number> {
  return fg(["stream/**/*.yft"], { cwd: resourceRoot, onlyFiles: true, dot: false }).then((files) => files.length);
}

export async function isVehicleOnlyResource(resourceRoot: string, streamCounts: MapStreamCounts): Promise<boolean> {
  if (hasCoreMapAssets(streamCounts)) {
    return false;
  }

  if (hasVehicleMeta(resourceRoot)) {
    return true;
  }

  return (await hasStreamYft(resourceRoot)) > 0;
}

async function manifestDeclaresMap(resourceRoot: string): Promise<boolean> {
  const manifestPath = path.join(resourceRoot, "fxmanifest.lua");
  if (!existsSync(manifestPath)) {
    return false;
  }

  try {
    const raw = await readFile(manifestPath, "utf8");
    return parseFxManifest(raw, "fxmanifest").isMap === true;
  } catch {
    return false;
  }
}

export async function isMapResourceCandidate(
  resourceRoot: string,
  resourceName: string,
  streamCounts?: MapStreamCounts,
): Promise<boolean> {
  const counts = streamCounts ?? (await countStreamAssets(resourceRoot));

  if (await isVehicleOnlyResource(resourceRoot, counts)) {
    return false;
  }

  if (hasCoreMapAssets(counts)) {
    return true;
  }

  if (await manifestDeclaresMap(resourceRoot)) {
    return true;
  }

  if (existsSync(path.join(resourceRoot, "data", "entrances.json"))) {
    return true;
  }

  if (
    isLikelyMapResource(resourceName)
    && !isLikelyVehicleResource(resourceName)
    && (await hasStreamYft(resourceRoot)) === 0
    && existsSync(path.join(resourceRoot, "stream"))
  ) {
    return true;
  }

  return false;
}

export interface ScanMapResourceResult {
  resourceName: string;
  resourcePath: string;
  hasManifest: boolean;
  streamCounts: MapStreamCounts;
  streamFileCount: number;
  hasEntrancesFile: boolean;
  hasTestPointsFile: boolean;
  hasDoorsFile: boolean;
  hasBlipsFile: boolean;
  entrances: ZoneCoord[];
  testPoints: unknown[];
}

async function countStreamAssets(resourceRoot: string): Promise<MapStreamCounts> {
  const files = await fg(["stream/**/*.*"], {
    cwd: resourceRoot,
    onlyFiles: true,
    dot: false,
  });

  const counts = { ymap: 0, ytyp: 0, ybn: 0, ydr: 0, ytd: 0, other: 0 };
  for (const file of files) {
    const ext = path.extname(file).slice(1).toLowerCase();
    if (ext === "ymap") counts.ymap += 1;
    else if (ext === "ytyp") counts.ytyp += 1;
    else if (ext === "ybn") counts.ybn += 1;
    else if (ext === "ydr") counts.ydr += 1;
    else if (ext === "ytd") counts.ytd += 1;
    else if (ext && ext !== "gitkeep") counts.other += 1;
  }

  return MapStreamCountsSchema.parse(counts);
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

export async function scanMapResource(options: {
  workspaceRoot: string;
  resourcesRoot: string;
  resourceName: string;
}): Promise<ScanMapResourceResult | null> {
  const resolved = resolveResourceDirectory(options.workspaceRoot, options.resourcesRoot, options.resourceName);
  if (!resolved) {
    return null;
  }

  const { resourceRoot, resourcePath } = resolved;
  const hasManifest = existsSync(path.join(resourceRoot, "fxmanifest.lua"));
  const streamCounts = await countStreamAssets(resourceRoot);
  const streamFileCount = Object.values(streamCounts).reduce((sum, count) => sum + count, 0);

  const entrancesPayload = await readJsonFile<{ entrances?: ZoneCoord[] }>(path.join(resourceRoot, "data", "entrances.json"));
  const testPointsPayload = await readJsonFile<{ testPoints?: unknown[] }>(
    path.join(resourceRoot, "data", "test_points.json"),
  );

  return {
    resourceName: options.resourceName,
    resourcePath,
    hasManifest,
    streamCounts,
    streamFileCount,
    hasEntrancesFile: existsSync(path.join(resourceRoot, "data", "entrances.json")),
    hasTestPointsFile: existsSync(path.join(resourceRoot, "data", "test_points.json")),
    hasDoorsFile: existsSync(path.join(resourceRoot, "data", "doors.json")),
    hasBlipsFile: existsSync(path.join(resourceRoot, "data", "blips.json")),
    entrances: entrancesPayload?.entrances ?? [],
    testPoints: testPointsPayload?.testPoints ?? [],
  };
}

export interface ScanWorkspaceMapsOptions {
  workspaceRoot: string;
  resourcesRoot: string;
  discover?: boolean;
  resourceName?: string;
}

export async function scanWorkspaceMaps(options: ScanWorkspaceMapsOptions): Promise<ScanMapResourceResult[]> {
  const resourcesRoot = path.resolve(options.workspaceRoot, options.resourcesRoot);

  if (options.resourceName) {
    const scanned = await scanMapResource({
      workspaceRoot: options.workspaceRoot,
      resourcesRoot: options.resourcesRoot,
      resourceName: options.resourceName,
    });
    return scanned ? [scanned] : [];
  }

  const resourceNames = [...discoverResourceNames(resourcesRoot)].sort();
  const results: ScanMapResourceResult[] = [];

  for (const resourceName of resourceNames) {
    const resolved = resolveResourceDirectory(options.workspaceRoot, options.resourcesRoot, resourceName);
    if (!resolved) {
      continue;
    }

    const streamCounts = await countStreamAssets(resolved.resourceRoot);
    const isCandidate = await isMapResourceCandidate(resolved.resourceRoot, resourceName, streamCounts);
    if (!isCandidate) {
      continue;
    }

    if (options.discover === false && !isLikelyMapResource(resourceName) && !hasCoreMapAssets(streamCounts)) {
      continue;
    }

    const scanned = await scanMapResource({
      workspaceRoot: options.workspaceRoot,
      resourcesRoot: options.resourcesRoot,
      resourceName,
    });
    if (!scanned) {
      continue;
    }
    results.push(scanned);
  }

  return results;
}

export async function syncMapRegistryFromScan(
  workspaceRoot: string,
  scan: ScanMapResourceResult,
  mapId?: string,
): Promise<MapPackage> {
  const maps = await listMapPackages(workspaceRoot);
  const existing = maps.find(
    (entry) => entry.resourceName === scan.resourceName || (mapId ? entry.id === sanitizeMapId(mapId) : false),
  );

  const preferredId = existing?.id ?? (mapId ? sanitizeMapId(mapId) : deriveMapIdFromResourceName(scan.resourceName));
  const id = ensureUniqueMapId(preferredId, maps, scan.resourceName);
  const label = existing?.label ?? scan.resourceName.replace(/_/g, " ");

  const draft = MapPackageSchema.parse({
    id,
    label,
    resourceName: scan.resourceName,
    resourcePath: scan.resourcePath,
    entrances: scan.entrances,
    checklist: existing?.checklist ?? createDefaultMapChecklist(),
    status: existing?.status ?? "draft",
    notes: existing?.notes,
    metadata: {
      ...(existing?.metadata ?? {}),
      hasManifest: scan.hasManifest,
      streamCounts: scan.streamCounts,
      streamFileCount: scan.streamFileCount,
      hasEntrancesFile: scan.hasEntrancesFile,
      hasTestPointsFile: scan.hasTestPointsFile,
      hasDoorsFile: scan.hasDoorsFile,
      hasBlipsFile: scan.hasBlipsFile,
      testPoints: scan.testPoints,
      lastScannedAt: new Date().toISOString(),
    },
  });

  const checklist = evaluateMapChecklist(draft);
  return upsertMapPackage(
    workspaceRoot,
    MapPackageSchema.parse({
      ...draft,
      checklist,
      status: deriveMapStatus(checklist),
    }),
  );
}

export { MAP_EXTENSIONS };
