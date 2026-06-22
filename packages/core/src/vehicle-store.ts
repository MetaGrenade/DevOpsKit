import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { VehicleRegistrySchema, VehicleSchema, type Vehicle, type VehicleRegistry } from "@fdt/schemas";
import { FDT_VEHICLES_FILE } from "./workspace.js";

function emptyRegistry(): VehicleRegistry {
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    vehicles: [],
  };
}

export function resolveVehiclesPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, FDT_VEHICLES_FILE);
}

export async function loadVehicleRegistry(workspaceRoot: string): Promise<VehicleRegistry> {
  const vehiclesPath = resolveVehiclesPath(workspaceRoot);
  if (!existsSync(vehiclesPath)) {
    return emptyRegistry();
  }

  const raw = await readFile(vehiclesPath, "utf8");
  return VehicleRegistrySchema.parse(JSON.parse(raw));
}

export async function saveVehicleRegistry(
  workspaceRoot: string,
  registry: VehicleRegistry,
): Promise<string> {
  const vehiclesPath = resolveVehiclesPath(workspaceRoot);
  await mkdir(path.dirname(vehiclesPath), { recursive: true });

  const payload: VehicleRegistry = {
    ...registry,
    updatedAt: new Date().toISOString(),
  };

  await writeFile(vehiclesPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return vehiclesPath;
}

export async function listVehicles(workspaceRoot: string): Promise<Vehicle[]> {
  const registry = await loadVehicleRegistry(workspaceRoot);
  return registry.vehicles;
}

export async function upsertVehicle(workspaceRoot: string, vehicle: Vehicle): Promise<Vehicle> {
  const parsed = VehicleSchema.parse(vehicle);
  const registry = await loadVehicleRegistry(workspaceRoot);
  const index = registry.vehicles.findIndex((existing) => existing.spawnName === parsed.spawnName);

  if (index >= 0) {
    registry.vehicles[index] = parsed;
  } else {
    registry.vehicles.push(parsed);
  }

  registry.vehicles.sort((a, b) => a.spawnName.localeCompare(b.spawnName));
  await saveVehicleRegistry(workspaceRoot, registry);
  return parsed;
}

export async function deleteVehicle(workspaceRoot: string, spawnName: string): Promise<boolean> {
  const registry = await loadVehicleRegistry(workspaceRoot);
  const before = registry.vehicles.length;
  registry.vehicles = registry.vehicles.filter((vehicle) => vehicle.spawnName !== spawnName);

  if (registry.vehicles.length === before) {
    return false;
  }

  await saveVehicleRegistry(workspaceRoot, registry);
  return true;
}
