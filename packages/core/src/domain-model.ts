import { FdtDomainModelSchema, type FdtDomainModel } from "@fdt/schemas";
import { listBusinesses } from "./business-store.js";
import { listClothingPacks } from "./clothing-store.js";
import { listGangs } from "./gang-store.js";
import { listCraftingRecipes } from "./crafting-store.js";
import { listShops } from "./shop-store.js";
import { listJobs } from "./job-store.js";
import { loadContentRegistry, toDomainModel } from "./content-store.js";
import { listMapPackages } from "./map-store.js";
import { listVehicles } from "./vehicle-store.js";

export async function loadDomainModel(workspaceRoot: string): Promise<FdtDomainModel> {
  const [itemsRegistry, vehicles, businesses, maps, jobs, gangs, clothingPacks, shops, craftingRecipes] =
    await Promise.all([
    loadContentRegistry(workspaceRoot),
    listVehicles(workspaceRoot),
    listBusinesses(workspaceRoot),
    listMapPackages(workspaceRoot),
    listJobs(workspaceRoot),
    listGangs(workspaceRoot),
    listClothingPacks(workspaceRoot),
    listShops(workspaceRoot),
    listCraftingRecipes(workspaceRoot),
  ]);

  return FdtDomainModelSchema.parse({
    ...toDomainModel(itemsRegistry),
    vehicles: [...vehicles].sort((a, b) => a.spawnName.localeCompare(b.spawnName)),
    businesses: [...businesses].sort((a, b) => a.id.localeCompare(b.id)),
    maps: [...maps].sort((a, b) => a.id.localeCompare(b.id)),
    jobs: [...jobs].sort((a, b) => a.id.localeCompare(b.id)),
    gangs: [...gangs].sort((a, b) => a.id.localeCompare(b.id)),
    clothingPacks: [...clothingPacks].sort((a, b) => a.id.localeCompare(b.id)),
    shops: [...shops].sort((a, b) => a.id.localeCompare(b.id)),
    craftingRecipes: [...craftingRecipes].sort((a, b) => a.id.localeCompare(b.id)),
  });
}
