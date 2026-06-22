import { describe, expect, it } from "vitest";
import type { FdtDomainModel } from "@fdt/schemas";
import { customJsonAdapter } from "./custom-json.js";
import { esxAdapter } from "./esx.js";
import { oxInventoryAdapter } from "./ox-inventory.js";
import { qbcoreAdapter } from "./qbcore.js";
import { qboxAdapter } from "./qbox.js";
import {
  renderEsxCraftingJson,
  renderEsxShopsJson,
  renderOxInventoryCraftingLua,
  renderOxInventoryShopsLua,
  renderQbCraftingLua,
  renderQbShopsLua,
} from "./commerce-render.js";

const commerceModel: FdtDomainModel = {
  items: [],
  vehicles: [],
  businesses: [],
  maps: [],
  jobs: [],
  gangs: [],
  clothingPacks: [],
  shops: [
    {
      id: "general_store",
      label: "General Store",
      type: "general",
      currency: "cash",
      locations: [{ coords: { x: 25.7, y: -1347.3, z: 29.5, w: 0 } }],
      items: [
        { itemId: "sandwich", price: 5, stock: 50, metadata: {} },
        { itemId: "water_bottle", price: 3, metadata: {} },
      ],
      metadata: {},
    },
    {
      id: "police_armory",
      label: "Police Armory",
      type: "job",
      currency: "bank",
      jobId: "police",
      locations: [{ coords: { x: 452.0, y: -980.0, z: 30.7 } }],
      items: [{ itemId: "armor", price: 0, minGrade: 2, metadata: {} }],
      metadata: {},
    },
  ],
  craftingRecipes: [
    {
      id: "lockpick",
      label: "Craft Lockpick",
      bench: "general",
      durationSeconds: 5,
      inputs: [{ itemId: "metalscrap", amount: 2 }],
      outputs: [{ itemId: "lockpick", amount: 1 }],
      metadata: {},
    },
  ],
};

const generatedAt = "2026-06-21T00:00:00.000Z";

describe("commerce shop and crafting exports", () => {
  it("exports shops and crafting through custom-json adapter", async () => {
    const result = await customJsonAdapter.export(commerceModel, { generatedAt });
    expect(result.files.map((file) => file.relativePath)).toEqual([
      "items.json",
      "shops.json",
      "crafting-recipes.json",
    ]);
  });

  it("exports qbcore merge-friendly shop and crafting lua", async () => {
    const result = await qbcoreAdapter.export(commerceModel, { generatedAt });
    expect(result.files.map((file) => file.relativePath)).toEqual([
      "shared/items.lua",
      "shared/fdt_shops.lua",
      "shared/fdt_crafting.lua",
    ]);

    const shops = result.files.find((file) => file.relativePath === "shared/fdt_shops.lua");
    expect(shops?.content).toBe(renderQbShopsLua(commerceModel, generatedAt, "qbcore"));
    expect(shops?.content).toContain("FDTShops.Locations");
    expect(shops?.content).toContain("requiredJob = 'police'");

    const crafting = result.files.find((file) => file.relativePath === "shared/fdt_crafting.lua");
    expect(crafting?.content).toBe(renderQbCraftingLua(commerceModel, generatedAt, "qbcore"));
    expect(crafting?.content).toContain("['metalscrap'] = 2");
  });

  it("exports qbox shop and crafting lua alongside ox items", async () => {
    const result = await qboxAdapter.export(commerceModel, { generatedAt });
    expect(result.files.map((file) => file.relativePath)).toEqual([
      "ox_inventory/data/items.fdt.lua",
      "qbx_shops/shared/fdt_shops.lua",
      "qbx_crafting/shared/fdt_crafting.lua",
    ]);
  });

  it("exports esx shop and crafting json catalogs", async () => {
    const result = await esxAdapter.export(commerceModel, { generatedAt });
    expect(result.files.map((file) => file.relativePath)).toEqual([
      "esx/items.sql",
      "esx/shops.json",
      "esx/crafting_recipes.json",
    ]);

    const shops = result.files.find((file) => file.relativePath === "esx/shops.json");
    expect(shops?.content).toBe(renderEsxShopsJson(commerceModel, generatedAt));
    expect(shops?.content).toContain('"police_armory"');

    const crafting = result.files.find((file) => file.relativePath === "esx/crafting_recipes.json");
    expect(crafting?.content).toBe(renderEsxCraftingJson(commerceModel, generatedAt));
  });

  it("exports ox_inventory merge-friendly shops and crafting lua", async () => {
    const result = await oxInventoryAdapter.export(commerceModel, { generatedAt });
    expect(result.files.map((file) => file.relativePath)).toEqual([
      "data/items.fdt.lua",
      "data/shops.fdt.lua",
      "data/crafting.fdt.lua",
    ]);

    const shops = result.files.find((file) => file.relativePath === "data/shops.fdt.lua");
    expect(shops?.content).toBe(renderOxInventoryShopsLua(commerceModel, generatedAt));
    expect(shops?.content).toContain("return {");

    const crafting = result.files.find((file) => file.relativePath === "data/crafting.fdt.lua");
    expect(crafting?.content).toBe(renderOxInventoryCraftingLua(commerceModel, generatedAt));
    expect(crafting?.content).toContain("ingredients = {");
  });
});
