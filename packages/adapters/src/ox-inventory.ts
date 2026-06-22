import type { FdtDomainModel } from "@fdt/schemas";
import type { AdapterExportOptions, FdtAdapter } from "./types.js";
import {
  renderOxInventoryCraftingLua,
  renderOxInventoryShopsLua,
} from "./commerce-render.js";
import { buildOxInventoryExport } from "./ox-inventory-render.js";

export const oxInventoryAdapter: FdtAdapter = {
  id: "ox-inventory",
  label: "ox_inventory",
  version: "1.0.0",
  capabilities: ["items", "shops", "crafting"],

  async export(model, options: AdapterExportOptions = {}) {
    const generatedAt = options.generatedAt ?? new Date().toISOString();
    const content = buildOxInventoryExport(model, {
      generatedAt,
      adapterId: "ox-inventory",
      adapterLabel: "ox_inventory/data/items.lua",
      relativePath: "data/items.fdt.lua",
    });

    const files = [
      {
        relativePath: "data/items.fdt.lua",
        content,
      },
    ];

    if (model.shops.length > 0) {
      files.push({
        relativePath: "data/shops.fdt.lua",
        content: renderOxInventoryShopsLua(model, generatedAt),
      });
    }

    if (model.craftingRecipes.length > 0) {
      files.push({
        relativePath: "data/crafting.fdt.lua",
        content: renderOxInventoryCraftingLua(model, generatedAt),
      });
    }

    return {
      adapterId: "ox-inventory",
      dryRun: options.dryRun ?? false,
      files,
    };
  },
};
