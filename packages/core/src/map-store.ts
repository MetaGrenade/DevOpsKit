import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  MapPackageSchema,
  MapRegistrySchema,
  type MapChecklistItem,
  type MapPackage,
  type MapRegistry,
} from "@fdt/schemas";
import { FDT_MAPS_FILE } from "./workspace.js";

function emptyRegistry(): MapRegistry {
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    maps: [],
  };
}

export function sanitizeMapId(value: string): string {
  let cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!cleaned) {
    cleaned = "map";
  }

  if (!/^[a-z]/.test(cleaned)) {
    cleaned = `map_${cleaned}`;
  }

  return cleaned;
}

export function deriveMapIdFromResourceName(resourceName: string): string {
  let cleaned = sanitizeMapId(resourceName);

  if (cleaned.startsWith("meta_map_")) {
    cleaned = `map_${cleaned.slice("meta_map_".length)}`;
  } else if (cleaned.startsWith("meta_")) {
    cleaned = cleaned.slice("meta_".length);
  }

  if (!cleaned) {
    return "map";
  }

  if (!/^[a-z]/.test(cleaned)) {
    cleaned = `map_${cleaned}`;
  }

  return cleaned;
}

export function ensureUniqueMapId(preferred: string, maps: MapPackage[], resourceName: string): string {
  const conflict = maps.find((entry) => entry.id === preferred && entry.resourceName !== resourceName);
  if (!conflict) {
    return preferred;
  }

  const alternate = deriveMapIdFromResourceName(resourceName);
  if (!maps.some((entry) => entry.id === alternate && entry.resourceName !== resourceName)) {
    return alternate;
  }

  let suffix = 2;
  while (maps.some((entry) => entry.id === `${preferred}_${suffix}`)) {
    suffix += 1;
  }

  return `${preferred}_${suffix}`;
}

export function createDefaultMapChecklist(): MapChecklistItem[] {
  return [
    {
      id: "manifest_present",
      label: "fxmanifest.lua exists",
      category: "manifest",
      required: true,
      passed: false,
    },
    {
      id: "stream_folder",
      label: "stream/ folder contains map assets",
      category: "stream",
      required: true,
      passed: false,
    },
    {
      id: "entrances_documented",
      label: "Entrance coordinates documented",
      category: "data",
      required: true,
      passed: false,
    },
    {
      id: "test_points",
      label: "QA test points defined",
      category: "qa",
      required: true,
      passed: false,
    },
    {
      id: "screenshots",
      label: "Reference screenshots captured",
      category: "release",
      required: false,
      passed: false,
    },
  ];
}

function streamAssetCount(mapPackage: MapPackage): number {
  if (typeof mapPackage.metadata.streamFileCount === "number") {
    return mapPackage.metadata.streamFileCount;
  }

  const counts = mapPackage.metadata.streamCounts;
  if (counts && typeof counts === "object") {
    return Object.values(counts as Record<string, number>).reduce((sum, count) => sum + (count ?? 0), 0);
  }

  return 0;
}

function hasCoreMapAssets(mapPackage: MapPackage): boolean {
  const counts = mapPackage.metadata.streamCounts;
  if (!counts || typeof counts !== "object") {
    return streamAssetCount(mapPackage) > 0;
  }

  const typed = counts as Record<string, number>;
  return (typed.ymap ?? 0) > 0 || (typed.ytyp ?? 0) > 0 || (typed.ybn ?? 0) > 0;
}

export function evaluateMapChecklist(mapPackage: MapPackage): MapChecklistItem[] {
  const checklist = mapPackage.checklist.length > 0 ? mapPackage.checklist : createDefaultMapChecklist();
  const testPoints = mapPackage.metadata.testPoints;

  return checklist.map((item) => {
    switch (item.id) {
      case "manifest_present":
        return {
          ...item,
          passed: mapPackage.metadata.hasManifest === true || Boolean(mapPackage.resourcePath),
        };
      case "stream_folder":
        return { ...item, passed: hasCoreMapAssets(mapPackage) };
      case "entrances_documented":
        return {
          ...item,
          passed: mapPackage.entrances.length > 0 || mapPackage.metadata.hasEntrancesFile === true,
        };
      case "test_points":
        return {
          ...item,
          passed: Array.isArray(testPoints) && testPoints.length > 0,
        };
      case "screenshots":
        return { ...item, passed: Boolean(mapPackage.metadata.screenshotsCaptured) };
      default:
        return item;
    }
  });
}

export function deriveMapStatus(checklist: MapChecklistItem[]): MapPackage["status"] {
  const required = checklist.filter((item) => item.required);
  if (required.every((item) => item.passed)) {
    return "ready";
  }
  if (checklist.some((item) => item.passed)) {
    return "audited";
  }
  return "draft";
}

export function resolveMapsPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, FDT_MAPS_FILE);
}

export async function loadMapRegistry(workspaceRoot: string): Promise<MapRegistry> {
  const mapsPath = resolveMapsPath(workspaceRoot);
  if (!existsSync(mapsPath)) {
    return emptyRegistry();
  }

  const raw = await readFile(mapsPath, "utf8");
  return MapRegistrySchema.parse(JSON.parse(raw));
}

export async function saveMapRegistry(workspaceRoot: string, registry: MapRegistry): Promise<string> {
  const mapsPath = resolveMapsPath(workspaceRoot);
  await mkdir(path.dirname(mapsPath), { recursive: true });

  const payload: MapRegistry = {
    ...registry,
    updatedAt: new Date().toISOString(),
  };

  await writeFile(mapsPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return mapsPath;
}

export async function listMapPackages(workspaceRoot: string): Promise<MapPackage[]> {
  const registry = await loadMapRegistry(workspaceRoot);
  return registry.maps;
}

export async function upsertMapPackage(workspaceRoot: string, mapPackage: MapPackage): Promise<MapPackage> {
  const parsed = MapPackageSchema.parse(mapPackage);
  const registry = await loadMapRegistry(workspaceRoot);
  const index = registry.maps.findIndex((existing) => existing.id === parsed.id);

  if (index >= 0) {
    registry.maps[index] = parsed;
  } else {
    registry.maps.push(parsed);
  }

  registry.maps.sort((a, b) => a.id.localeCompare(b.id));
  await saveMapRegistry(workspaceRoot, registry);
  return parsed;
}

export async function deleteMapPackage(workspaceRoot: string, mapId: string): Promise<boolean> {
  const registry = await loadMapRegistry(workspaceRoot);
  const before = registry.maps.length;
  registry.maps = registry.maps.filter((mapPackage) => mapPackage.id !== mapId);

  if (registry.maps.length === before) {
    return false;
  }

  await saveMapRegistry(workspaceRoot, registry);
  return true;
}

export async function refreshMapChecklist(workspaceRoot: string, mapId: string): Promise<MapPackage> {
  const registry = await loadMapRegistry(workspaceRoot);
  const index = registry.maps.findIndex((mapPackage) => mapPackage.id === mapId);
  if (index < 0) {
    throw new Error(`Map package not found: ${mapId}`);
  }

  const current = registry.maps[index]!;
  const checklist = evaluateMapChecklist(current);
  const updated = MapPackageSchema.parse({
    ...current,
    checklist,
    status: deriveMapStatus(checklist),
  });

  registry.maps[index] = updated;
  await saveMapRegistry(workspaceRoot, registry);
  return updated;
}

export async function createMapPackage(
  workspaceRoot: string,
  input: {
    id: string;
    label: string;
    resourceName: string;
    resourcePath?: string;
    entrances?: MapPackage["entrances"];
    notes?: string;
  },
): Promise<MapPackage> {
  const mapPackage = MapPackageSchema.parse({
    id: input.id,
    label: input.label,
    resourceName: input.resourceName,
    resourcePath: input.resourcePath,
    entrances: input.entrances ?? [],
    checklist: createDefaultMapChecklist(),
    status: "draft",
    notes: input.notes,
    metadata: {},
  });

  return upsertMapPackage(workspaceRoot, mapPackage);
}
