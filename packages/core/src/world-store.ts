import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  BlipExportSchema,
  BlipRegistrySchema,
  BlipSchema,
  DoorExportSchema,
  DoorRegistrySchema,
  DoorSchema,
  PropExportSchema,
  PropRegistrySchema,
  PropPlacementSchema,
  WorldExportSchema,
  type Blip,
  type BlipExport,
  type BlipRegistry,
  type Door,
  type DoorExport,
  type DoorRegistry,
  type PropPlacement,
  type PropExport,
  type PropRegistry,
  type WorldExport,
} from "@fdt/schemas";
import { FDT_BLIPS_FILE, FDT_DOORS_FILE, FDT_PROPS_FILE } from "./workspace.js";

function emptyBlipRegistry(): BlipRegistry {
  return { schemaVersion: 1, updatedAt: new Date().toISOString(), blips: [] };
}

function emptyPropRegistry(): PropRegistry {
  return { schemaVersion: 1, updatedAt: new Date().toISOString(), props: [] };
}

function emptyDoorRegistry(): DoorRegistry {
  return { schemaVersion: 1, updatedAt: new Date().toISOString(), doors: [] };
}

export function resolveBlipsPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, FDT_BLIPS_FILE);
}

export function resolvePropsPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, FDT_PROPS_FILE);
}

export function resolveDoorsPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, FDT_DOORS_FILE);
}

export async function loadBlipRegistry(workspaceRoot: string): Promise<BlipRegistry> {
  const filePath = resolveBlipsPath(workspaceRoot);
  if (!existsSync(filePath)) {
    return emptyBlipRegistry();
  }
  return BlipRegistrySchema.parse(JSON.parse(await readFile(filePath, "utf8")));
}

export async function loadPropRegistry(workspaceRoot: string): Promise<PropRegistry> {
  const filePath = resolvePropsPath(workspaceRoot);
  if (!existsSync(filePath)) {
    return emptyPropRegistry();
  }
  return PropRegistrySchema.parse(JSON.parse(await readFile(filePath, "utf8")));
}

export async function loadDoorRegistry(workspaceRoot: string): Promise<DoorRegistry> {
  const filePath = resolveDoorsPath(workspaceRoot);
  if (!existsSync(filePath)) {
    return emptyDoorRegistry();
  }
  return DoorRegistrySchema.parse(JSON.parse(await readFile(filePath, "utf8")));
}

async function saveBlipRegistry(workspaceRoot: string, registry: BlipRegistry): Promise<string> {
  const filePath = resolveBlipsPath(workspaceRoot);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    `${JSON.stringify({ ...registry, updatedAt: new Date().toISOString() }, null, 2)}\n`,
    "utf8",
  );
  return filePath;
}

async function savePropRegistry(workspaceRoot: string, registry: PropRegistry): Promise<string> {
  const filePath = resolvePropsPath(workspaceRoot);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    `${JSON.stringify({ ...registry, updatedAt: new Date().toISOString() }, null, 2)}\n`,
    "utf8",
  );
  return filePath;
}

async function saveDoorRegistry(workspaceRoot: string, registry: DoorRegistry): Promise<string> {
  const filePath = resolveDoorsPath(workspaceRoot);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    `${JSON.stringify({ ...registry, updatedAt: new Date().toISOString() }, null, 2)}\n`,
    "utf8",
  );
  return filePath;
}

export async function listBlips(workspaceRoot: string): Promise<Blip[]> {
  return (await loadBlipRegistry(workspaceRoot)).blips;
}

export async function listProps(workspaceRoot: string): Promise<PropPlacement[]> {
  return (await loadPropRegistry(workspaceRoot)).props;
}

export async function listDoors(workspaceRoot: string): Promise<Door[]> {
  return (await loadDoorRegistry(workspaceRoot)).doors;
}

export async function upsertBlip(workspaceRoot: string, blip: Blip): Promise<Blip> {
  const parsed = BlipSchema.parse(blip);
  const registry = await loadBlipRegistry(workspaceRoot);
  const index = registry.blips.findIndex((item) => item.id === parsed.id);
  if (index >= 0) {
    registry.blips[index] = parsed;
  } else {
    registry.blips.push(parsed);
  }
  registry.blips.sort((a, b) => a.id.localeCompare(b.id));
  await saveBlipRegistry(workspaceRoot, registry);
  return parsed;
}

export async function upsertProp(workspaceRoot: string, prop: PropPlacement): Promise<PropPlacement> {
  const parsed = PropPlacementSchema.parse(prop);
  const registry = await loadPropRegistry(workspaceRoot);
  const index = registry.props.findIndex((item) => item.id === parsed.id);
  if (index >= 0) {
    registry.props[index] = parsed;
  } else {
    registry.props.push(parsed);
  }
  registry.props.sort((a, b) => a.id.localeCompare(b.id));
  await savePropRegistry(workspaceRoot, registry);
  return parsed;
}

export async function upsertDoor(workspaceRoot: string, door: Door): Promise<Door> {
  const parsed = DoorSchema.parse(door);
  const registry = await loadDoorRegistry(workspaceRoot);
  const index = registry.doors.findIndex((item) => item.id === parsed.id);
  if (index >= 0) {
    registry.doors[index] = parsed;
  } else {
    registry.doors.push(parsed);
  }
  registry.doors.sort((a, b) => a.id.localeCompare(b.id));
  await saveDoorRegistry(workspaceRoot, registry);
  return parsed;
}

export async function deleteBlip(workspaceRoot: string, id: string): Promise<boolean> {
  const registry = await loadBlipRegistry(workspaceRoot);
  const before = registry.blips.length;
  registry.blips = registry.blips.filter((item) => item.id !== id);
  if (registry.blips.length === before) {
    return false;
  }
  await saveBlipRegistry(workspaceRoot, registry);
  return true;
}

export async function deleteProp(workspaceRoot: string, id: string): Promise<boolean> {
  const registry = await loadPropRegistry(workspaceRoot);
  const before = registry.props.length;
  registry.props = registry.props.filter((item) => item.id !== id);
  if (registry.props.length === before) {
    return false;
  }
  await savePropRegistry(workspaceRoot, registry);
  return true;
}

export async function deleteDoor(workspaceRoot: string, id: string): Promise<boolean> {
  const registry = await loadDoorRegistry(workspaceRoot);
  const before = registry.doors.length;
  registry.doors = registry.doors.filter((item) => item.id !== id);
  if (registry.doors.length === before) {
    return false;
  }
  await saveDoorRegistry(workspaceRoot, registry);
  return true;
}

export async function importBlipExport(
  workspaceRoot: string,
  payload: BlipExport,
): Promise<{ imported: number; blips: Blip[] }> {
  const parsed = BlipExportSchema.parse(payload);
  const registry = await loadBlipRegistry(workspaceRoot);
  for (const blip of parsed.blips) {
    const validated = BlipSchema.parse(blip);
    const index = registry.blips.findIndex((item) => item.id === validated.id);
    if (index >= 0) {
      registry.blips[index] = validated;
    } else {
      registry.blips.push(validated);
    }
  }
  registry.blips.sort((a, b) => a.id.localeCompare(b.id));
  await saveBlipRegistry(workspaceRoot, registry);
  return { imported: parsed.blips.length, blips: registry.blips };
}

export async function importPropExport(
  workspaceRoot: string,
  payload: PropExport,
): Promise<{ imported: number; props: PropPlacement[] }> {
  const parsed = PropExportSchema.parse(payload);
  const registry = await loadPropRegistry(workspaceRoot);
  for (const prop of parsed.props) {
    const validated = PropPlacementSchema.parse(prop);
    const index = registry.props.findIndex((item) => item.id === validated.id);
    if (index >= 0) {
      registry.props[index] = validated;
    } else {
      registry.props.push(validated);
    }
  }
  registry.props.sort((a, b) => a.id.localeCompare(b.id));
  await savePropRegistry(workspaceRoot, registry);
  return { imported: parsed.props.length, props: registry.props };
}

export async function importDoorExport(
  workspaceRoot: string,
  payload: DoorExport,
): Promise<{ imported: number; doors: Door[] }> {
  const parsed = DoorExportSchema.parse(payload);
  const registry = await loadDoorRegistry(workspaceRoot);
  for (const door of parsed.doors) {
    const validated = DoorSchema.parse(door);
    const index = registry.doors.findIndex((item) => item.id === validated.id);
    if (index >= 0) {
      registry.doors[index] = validated;
    } else {
      registry.doors.push(validated);
    }
  }
  registry.doors.sort((a, b) => a.id.localeCompare(b.id));
  await saveDoorRegistry(workspaceRoot, registry);
  return { imported: parsed.doors.length, doors: registry.doors };
}

export async function importWorldExport(
  workspaceRoot: string,
  payload: WorldExport,
): Promise<{ importedBlips: number; importedProps: number; importedDoors: number }> {
  const parsed = WorldExportSchema.parse(payload);
  let importedBlips = 0;
  let importedProps = 0;
  let importedDoors = 0;

  if (parsed.blips && parsed.blips.length > 0) {
    importedBlips = (
      await importBlipExport(workspaceRoot, {
        schemaVersion: 1,
        exportedAt: parsed.exportedAt,
        exportedBy: parsed.exportedBy,
        resource: "fdt_devtools",
        blips: parsed.blips,
      })
    ).imported;
  }

  if (parsed.props && parsed.props.length > 0) {
    importedProps = (
      await importPropExport(workspaceRoot, {
        schemaVersion: 1,
        exportedAt: parsed.exportedAt,
        exportedBy: parsed.exportedBy,
        resource: "fdt_devtools",
        props: parsed.props,
      })
    ).imported;
  }

  if (parsed.doors && parsed.doors.length > 0) {
    importedDoors = (
      await importDoorExport(workspaceRoot, {
        schemaVersion: 1,
        exportedAt: parsed.exportedAt,
        exportedBy: parsed.exportedBy,
        resource: "fdt_devtools",
        doors: parsed.doors,
      })
    ).imported;
  }

  return { importedBlips, importedProps, importedDoors };
}
