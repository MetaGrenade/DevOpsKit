import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  ZoneExportSchema,
  ZoneRegistrySchema,
  ZoneSchema,
  type Zone,
  type ZoneExport,
  type ZoneRegistry,
} from "@fdt/schemas";
import { FDT_ZONES_FILE } from "./workspace.js";

function emptyRegistry(): ZoneRegistry {
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    zones: [],
  };
}

export function resolveZonesPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, FDT_ZONES_FILE);
}

export async function loadZoneRegistry(workspaceRoot: string): Promise<ZoneRegistry> {
  const zonesPath = resolveZonesPath(workspaceRoot);

  if (!existsSync(zonesPath)) {
    return emptyRegistry();
  }

  const raw = await readFile(zonesPath, "utf8");
  return ZoneRegistrySchema.parse(JSON.parse(raw));
}

export async function saveZoneRegistry(
  workspaceRoot: string,
  registry: ZoneRegistry,
): Promise<string> {
  const zonesPath = resolveZonesPath(workspaceRoot);
  await mkdir(path.dirname(zonesPath), { recursive: true });

  const payload: ZoneRegistry = {
    ...registry,
    updatedAt: new Date().toISOString(),
  };

  await writeFile(zonesPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return zonesPath;
}

export async function listZones(workspaceRoot: string): Promise<Zone[]> {
  const registry = await loadZoneRegistry(workspaceRoot);
  return registry.zones;
}

export async function upsertZone(workspaceRoot: string, zone: Zone): Promise<Zone> {
  const parsed = ZoneSchema.parse(zone);
  const registry = await loadZoneRegistry(workspaceRoot);
  const index = registry.zones.findIndex((existing) => existing.id === parsed.id);

  if (index >= 0) {
    registry.zones[index] = parsed;
  } else {
    registry.zones.push(parsed);
  }

  registry.zones.sort((a, b) => a.id.localeCompare(b.id));
  await saveZoneRegistry(workspaceRoot, registry);
  return parsed;
}

export async function deleteZone(workspaceRoot: string, zoneId: string): Promise<boolean> {
  const registry = await loadZoneRegistry(workspaceRoot);
  const before = registry.zones.length;
  registry.zones = registry.zones.filter((zone) => zone.id !== zoneId);

  if (registry.zones.length === before) {
    return false;
  }

  await saveZoneRegistry(workspaceRoot, registry);
  return true;
}

export async function importZoneExport(
  workspaceRoot: string,
  payload: ZoneExport,
): Promise<{ imported: number; zones: Zone[] }> {
  const parsed = ZoneExportSchema.parse(payload);
  const registry = await loadZoneRegistry(workspaceRoot);

  for (const zone of parsed.zones) {
    const validated = ZoneSchema.parse(zone);
    const index = registry.zones.findIndex((existing) => existing.id === validated.id);
    if (index >= 0) {
      registry.zones[index] = validated;
    } else {
      registry.zones.push(validated);
    }
  }

  registry.zones.sort((a, b) => a.id.localeCompare(b.id));
  await saveZoneRegistry(workspaceRoot, registry);

  return {
    imported: parsed.zones.length,
    zones: registry.zones,
  };
}
