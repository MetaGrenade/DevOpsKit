import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  ClothingPackSchema,
  ClothingRegistrySchema,
  type ClothingPack,
  type ClothingRegistry,
} from "@fdt/schemas";
import { FDT_CLOTHING_PACKS_FILE } from "./workspace.js";

function emptyRegistry(): ClothingRegistry {
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    packs: [],
  };
}

export function resolveClothingPacksPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, FDT_CLOTHING_PACKS_FILE);
}

export async function loadClothingRegistry(workspaceRoot: string): Promise<ClothingRegistry> {
  const packsPath = resolveClothingPacksPath(workspaceRoot);
  if (!existsSync(packsPath)) {
    return emptyRegistry();
  }

  const raw = await readFile(packsPath, "utf8");
  return ClothingRegistrySchema.parse(JSON.parse(raw));
}

export async function saveClothingRegistry(
  workspaceRoot: string,
  registry: ClothingRegistry,
): Promise<string> {
  const packsPath = resolveClothingPacksPath(workspaceRoot);
  await mkdir(path.dirname(packsPath), { recursive: true });

  const payload: ClothingRegistry = {
    ...registry,
    updatedAt: new Date().toISOString(),
  };

  await writeFile(packsPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return packsPath;
}

export async function listClothingPacks(workspaceRoot: string): Promise<ClothingPack[]> {
  const registry = await loadClothingRegistry(workspaceRoot);
  return registry.packs;
}

export async function getClothingPack(
  workspaceRoot: string,
  packId: string,
): Promise<ClothingPack | null> {
  const registry = await loadClothingRegistry(workspaceRoot);
  return registry.packs.find((pack) => pack.id === packId) ?? null;
}

export async function upsertClothingPack(
  workspaceRoot: string,
  pack: ClothingPack,
): Promise<ClothingPack> {
  const parsed = ClothingPackSchema.parse(pack);
  const registry = await loadClothingRegistry(workspaceRoot);
  const index = registry.packs.findIndex((existing) => existing.id === parsed.id);

  if (index >= 0) {
    registry.packs[index] = parsed;
  } else {
    registry.packs.push(parsed);
  }

  registry.packs.sort((a, b) => a.id.localeCompare(b.id));
  await saveClothingRegistry(workspaceRoot, registry);
  return parsed;
}

export async function deleteClothingPack(workspaceRoot: string, packId: string): Promise<boolean> {
  const registry = await loadClothingRegistry(workspaceRoot);
  const before = registry.packs.length;
  registry.packs = registry.packs.filter((pack) => pack.id !== packId);

  if (registry.packs.length === before) {
    return false;
  }

  await saveClothingRegistry(workspaceRoot, registry);
  return true;
}

export async function createClothingPack(
  workspaceRoot: string,
  input: {
    id: string;
    label: string;
    resourceName: string;
    resourcePath?: string;
    genderScope?: ClothingPack["genderScope"];
    tags?: ClothingPack["tags"];
  },
): Promise<ClothingPack> {
  const pack = ClothingPackSchema.parse({
    id: input.id,
    label: input.label,
    resourceName: input.resourceName,
    resourcePath: input.resourcePath,
    genderScope: input.genderScope ?? "shared",
    tags: input.tags ?? [],
    drawables: [],
    status: "draft",
    metadata: {},
  });

  return upsertClothingPack(workspaceRoot, pack);
}
