import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  CraftingRecipeSchema,
  CraftingRegistrySchema,
  type CraftingRecipe,
  type CraftingRegistry,
} from "@fdt/schemas";
import { FDT_CRAFTING_FILE } from "./workspace.js";

function emptyRegistry(): CraftingRegistry {
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    recipes: [],
  };
}

export function resolveCraftingPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, FDT_CRAFTING_FILE);
}

export async function loadCraftingRegistry(workspaceRoot: string): Promise<CraftingRegistry> {
  const craftingPath = resolveCraftingPath(workspaceRoot);
  if (!existsSync(craftingPath)) {
    return emptyRegistry();
  }

  const raw = await readFile(craftingPath, "utf8");
  return CraftingRegistrySchema.parse(JSON.parse(raw));
}

export async function saveCraftingRegistry(
  workspaceRoot: string,
  registry: CraftingRegistry,
): Promise<string> {
  const craftingPath = resolveCraftingPath(workspaceRoot);
  await mkdir(path.dirname(craftingPath), { recursive: true });

  const payload: CraftingRegistry = {
    ...registry,
    updatedAt: new Date().toISOString(),
  };

  await writeFile(craftingPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return craftingPath;
}

export async function listCraftingRecipes(workspaceRoot: string): Promise<CraftingRecipe[]> {
  const registry = await loadCraftingRegistry(workspaceRoot);
  return registry.recipes;
}

export async function upsertCraftingRecipe(
  workspaceRoot: string,
  recipe: CraftingRecipe,
): Promise<CraftingRecipe> {
  const parsed = CraftingRecipeSchema.parse(recipe);
  const registry = await loadCraftingRegistry(workspaceRoot);
  const index = registry.recipes.findIndex((existing) => existing.id === parsed.id);

  if (index >= 0) {
    registry.recipes[index] = parsed;
  } else {
    registry.recipes.push(parsed);
  }

  registry.recipes.sort((a, b) => a.id.localeCompare(b.id));
  await saveCraftingRegistry(workspaceRoot, registry);
  return parsed;
}

export async function deleteCraftingRecipe(workspaceRoot: string, recipeId: string): Promise<boolean> {
  const registry = await loadCraftingRegistry(workspaceRoot);
  const before = registry.recipes.length;
  registry.recipes = registry.recipes.filter((recipe) => recipe.id !== recipeId);

  if (registry.recipes.length === before) {
    return false;
  }

  await saveCraftingRegistry(workspaceRoot, registry);
  return true;
}
