import type {
  Business,
  ClothingPack,
  CraftingRecipe,
  Gang,
  Item,
  Job,
  MapPackage,
  FdtDomainModel,
  Shop,
  Vehicle,
} from "@fdt/schemas";
import type { AdapterExportOptions, FdtAdapter } from "./types.js";
import { renderClothingShopJson } from "./clothing-render.js";
import { renderVehicleShopJson } from "./vehicle-render.js";

function sortedItems(model: FdtDomainModel): Item[] {
  return [...model.items].sort((a, b) => a.id.localeCompare(b.id));
}

function sortedVehicles(model: FdtDomainModel): Vehicle[] {
  return [...model.vehicles].sort((a, b) => a.spawnName.localeCompare(b.spawnName));
}

function sortedBusinesses(model: FdtDomainModel): Business[] {
  return [...model.businesses].sort((a, b) => a.id.localeCompare(b.id));
}

function sortedMaps(model: FdtDomainModel): MapPackage[] {
  return [...model.maps].sort((a, b) => a.id.localeCompare(b.id));
}

function sortedJobs(model: FdtDomainModel): Job[] {
  return [...model.jobs].sort((a, b) => a.id.localeCompare(b.id));
}

function sortedGangs(model: FdtDomainModel): Gang[] {
  return [...model.gangs].sort((a, b) => a.id.localeCompare(b.id));
}

function sortedClothingPacks(model: FdtDomainModel): ClothingPack[] {
  return [...model.clothingPacks].sort((a, b) => a.id.localeCompare(b.id));
}

function sortedShops(model: FdtDomainModel): Shop[] {
  return [...model.shops].sort((a, b) => a.id.localeCompare(b.id));
}

function sortedCraftingRecipes(model: FdtDomainModel): CraftingRecipe[] {
  return [...model.craftingRecipes].sort((a, b) => a.id.localeCompare(b.id));
}

export const customJsonAdapter: FdtAdapter = {
  id: "custom-json",
  label: "Custom JSON",
  version: "1.0.0",
  capabilities: ["items", "vehicles", "businesses", "maps", "jobs", "gangs", "clothing", "shops", "crafting"],

  async export(model, options: AdapterExportOptions = {}) {
    const generatedAt = options.generatedAt ?? new Date().toISOString();
    const files = [
      {
        relativePath: "items.json",
        content: `${JSON.stringify(
          {
            schemaVersion: 1,
            generatedAt,
            items: sortedItems(model),
          },
          null,
          2,
        )}\n`,
      },
    ];

    if (model.vehicles.length > 0) {
      files.push({
        relativePath: "vehicles.json",
        content: `${JSON.stringify(
          {
            schemaVersion: 1,
            generatedAt,
            vehicles: sortedVehicles(model),
          },
          null,
          2,
        )}\n`,
      });
      files.push({
        relativePath: "vehicle-shop.json",
        content: renderVehicleShopJson(model, generatedAt),
      });
    }

    if (model.businesses.length > 0) {
      files.push({
        relativePath: "businesses.json",
        content: `${JSON.stringify(
          {
            schemaVersion: 1,
            generatedAt,
            businesses: sortedBusinesses(model),
          },
          null,
          2,
        )}\n`,
      });
    }

    if (model.maps.length > 0) {
      files.push({
        relativePath: "maps.json",
        content: `${JSON.stringify(
          {
            schemaVersion: 1,
            generatedAt,
            maps: sortedMaps(model),
          },
          null,
          2,
        )}\n`,
      });
    }

    if (model.jobs.length > 0) {
      files.push({
        relativePath: "jobs.json",
        content: `${JSON.stringify(
          {
            schemaVersion: 1,
            generatedAt,
            jobs: sortedJobs(model),
          },
          null,
          2,
        )}\n`,
      });
    }

    if (model.gangs.length > 0) {
      files.push({
        relativePath: "gangs.json",
        content: `${JSON.stringify(
          {
            schemaVersion: 1,
            generatedAt,
            gangs: sortedGangs(model),
          },
          null,
          2,
        )}\n`,
      });
    }

    if (model.clothingPacks.length > 0) {
      files.push({
        relativePath: "clothing-packs.json",
        content: `${JSON.stringify(
          {
            schemaVersion: 1,
            generatedAt,
            packs: sortedClothingPacks(model),
          },
          null,
          2,
        )}\n`,
      });
      files.push({
        relativePath: "clothing-shop.json",
        content: renderClothingShopJson(model, generatedAt),
      });
    }

    if (model.shops.length > 0) {
      files.push({
        relativePath: "shops.json",
        content: `${JSON.stringify(
          {
            schemaVersion: 1,
            generatedAt,
            shops: sortedShops(model),
          },
          null,
          2,
        )}\n`,
      });
    }

    if (model.craftingRecipes.length > 0) {
      files.push({
        relativePath: "crafting-recipes.json",
        content: `${JSON.stringify(
          {
            schemaVersion: 1,
            generatedAt,
            recipes: sortedCraftingRecipes(model),
          },
          null,
          2,
        )}\n`,
      });
    }

    return {
      adapterId: "custom-json",
      dryRun: options.dryRun ?? false,
      files,
    };
  },
};
