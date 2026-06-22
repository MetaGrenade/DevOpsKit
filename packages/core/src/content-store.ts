import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { ContentRegistrySchema, ItemSchema, type ContentRegistry, type Item, type FdtDomainModel } from "@fdt/schemas";
import { FDT_ITEMS_FILE } from "./workspace.js";

function emptyRegistry(): ContentRegistry {
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    items: [],
  };
}

export function resolveItemsPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, FDT_ITEMS_FILE);
}

export async function loadContentRegistry(workspaceRoot: string): Promise<ContentRegistry> {
  const itemsPath = resolveItemsPath(workspaceRoot);

  if (!existsSync(itemsPath)) {
    return emptyRegistry();
  }

  const raw = await readFile(itemsPath, "utf8");
  return ContentRegistrySchema.parse(JSON.parse(raw));
}

export async function saveContentRegistry(
  workspaceRoot: string,
  registry: ContentRegistry,
): Promise<string> {
  const itemsPath = resolveItemsPath(workspaceRoot);
  await mkdir(path.dirname(itemsPath), { recursive: true });

  const payload: ContentRegistry = {
    ...registry,
    updatedAt: new Date().toISOString(),
  };

  await writeFile(itemsPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return itemsPath;
}

export async function listItems(workspaceRoot: string): Promise<Item[]> {
  const registry = await loadContentRegistry(workspaceRoot);
  return registry.items;
}

export async function upsertItem(workspaceRoot: string, item: Item): Promise<Item> {
  const parsed = ItemSchema.parse(item);
  const registry = await loadContentRegistry(workspaceRoot);
  const index = registry.items.findIndex((existing) => existing.id === parsed.id);

  if (index >= 0) {
    registry.items[index] = parsed;
  } else {
    registry.items.push(parsed);
  }

  registry.items.sort((a, b) => a.id.localeCompare(b.id));
  await saveContentRegistry(workspaceRoot, registry);
  return parsed;
}

export async function deleteItem(workspaceRoot: string, itemId: string): Promise<boolean> {
  const registry = await loadContentRegistry(workspaceRoot);
  const before = registry.items.length;
  registry.items = registry.items.filter((item) => item.id !== itemId);

  if (registry.items.length === before) {
    return false;
  }

  await saveContentRegistry(workspaceRoot, registry);
  return true;
}

export function toDomainModel(registry: ContentRegistry): FdtDomainModel {
  return {
    items: [...registry.items].sort((a, b) => a.id.localeCompare(b.id)),
    vehicles: [],
    businesses: [],
    maps: [],
    jobs: [],
    gangs: [],
    clothingPacks: [],
    shops: [],
    craftingRecipes: [],
  };
}
