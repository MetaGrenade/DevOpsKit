import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  GangRegistrySchema,
  GangSchema,
  GangTypeSchema,
  ZonePurposeSchema,
  type Gang,
  type GangRegistry,
  type Zone,
} from "@fdt/schemas";
import { FDT_GANGS_FILE } from "./workspace.js";
import { loadZoneRegistry } from "./zone-store.js";

function emptyRegistry(): GangRegistry {
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    gangs: [],
  };
}

export function resolveGangsPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, FDT_GANGS_FILE);
}

export async function loadGangRegistry(workspaceRoot: string): Promise<GangRegistry> {
  const gangsPath = resolveGangsPath(workspaceRoot);
  if (!existsSync(gangsPath)) {
    return emptyRegistry();
  }

  const raw = await readFile(gangsPath, "utf8");
  return GangRegistrySchema.parse(JSON.parse(raw));
}

export async function saveGangRegistry(workspaceRoot: string, registry: GangRegistry): Promise<string> {
  const gangsPath = resolveGangsPath(workspaceRoot);
  await mkdir(path.dirname(gangsPath), { recursive: true });

  const payload: GangRegistry = {
    ...registry,
    updatedAt: new Date().toISOString(),
  };

  await writeFile(gangsPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return gangsPath;
}

export async function listGangs(workspaceRoot: string): Promise<Gang[]> {
  const registry = await loadGangRegistry(workspaceRoot);
  return registry.gangs;
}

export async function upsertGang(workspaceRoot: string, gang: Gang): Promise<Gang> {
  const parsed = GangSchema.parse(gang);
  const registry = await loadGangRegistry(workspaceRoot);
  const index = registry.gangs.findIndex((existing) => existing.id === parsed.id);

  if (index >= 0) {
    registry.gangs[index] = parsed;
  } else {
    registry.gangs.push(parsed);
  }

  registry.gangs.sort((a, b) => a.id.localeCompare(b.id));
  await saveGangRegistry(workspaceRoot, registry);
  return parsed;
}

export async function deleteGang(workspaceRoot: string, gangId: string): Promise<boolean> {
  const registry = await loadGangRegistry(workspaceRoot);
  const before = registry.gangs.length;
  registry.gangs = registry.gangs.filter((gang) => gang.id !== gangId);

  if (registry.gangs.length === before) {
    return false;
  }

  await saveGangRegistry(workspaceRoot, registry);
  return true;
}

const PURPOSE_TO_GANG_TYPE: Record<string, Gang["type"]> = {
  territory: "gang",
  job: "organization",
  shop: "organization",
  stash: "crew",
  garage: "crew",
  interaction: "custom",
  event: "custom",
  custom: "custom",
};

export function mapZonePurposeToGangType(purpose: Zone["purpose"]): Gang["type"] {
  const parsed = ZonePurposeSchema.parse(purpose);
  return PURPOSE_TO_GANG_TYPE[parsed] ?? "custom";
}

export async function createGangFromZone(
  workspaceRoot: string,
  input: {
    zoneId: string;
    id?: string;
    label?: string;
    type?: Gang["type"];
  },
): Promise<Gang> {
  const zones = await loadZoneRegistry(workspaceRoot);
  const zone = zones.zones.find((item) => item.id === input.zoneId);
  if (!zone) {
    throw new Error(`Zone not found: ${input.zoneId}`);
  }

  const gangId = input.id ?? `gang_${zone.id}`;
  const gangType = input.type ?? mapZonePurposeToGangType(zone.purpose);
  GangTypeSchema.parse(gangType);

  const gang = GangSchema.parse({
    id: gangId,
    label: input.label ?? zone.label,
    type: gangType,
    zoneIds: [zone.id],
    territoryIds: zone.purpose === "territory" ? [zone.id] : [],
    grades: [{ id: "member", level: 0, label: "Member" }],
    metadata: {
      sourceZonePurpose: zone.purpose,
      zoneType: zone.type,
    },
  });

  return upsertGang(workspaceRoot, gang);
}
