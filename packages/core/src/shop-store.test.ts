import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { upsertItem } from "./content-store.js";
import { listCraftingRecipes, upsertCraftingRecipe } from "./crafting-store.js";
import { createShopFromZone, listShops, upsertShop } from "./shop-store.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeWorkspace() {
  const root = await mkdtemp(path.join(os.tmpdir(), "fdt-shop-store-"));
  tempDirs.push(root);

  await mkdir(path.join(root, ".fdt", "zones"), { recursive: true });
  await writeFile(
    path.join(root, ".fdt", "zones", "zones.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
        zones: [
          {
            id: "general_store_zone",
            label: "General Store",
            type: "sphere",
            purpose: "shop",
            coords: [{ x: 10, y: 20, z: 30 }],
            radius: 2,
            metadata: {},
          },
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  await upsertItem(root, {
    id: "water",
    label: "Water",
    category: "drink",
    weight: 100,
    stackable: true,
    unique: false,
    usable: true,
    metadata: {},
  });

  return root;
}

describe("shop and crafting stores", () => {
  it("creates a shop from a zone and saves crafting recipes", async () => {
    const root = await makeWorkspace();

    const shop = await createShopFromZone(root, { zoneId: "general_store_zone" });
    expect(shop.id).toBe("shop_general_store_zone");
    expect(shop.locations[0]?.zoneId).toBe("general_store_zone");

    const withInventory = await upsertShop(root, {
      ...shop,
      items: [{ itemId: "water", price: 5, metadata: {} }],
    });
    expect(withInventory.items).toHaveLength(1);

    const shops = await listShops(root);
    expect(shops.some((entry) => entry.id === shop.id)).toBe(true);

    const recipe = await upsertCraftingRecipe(root, {
      id: "purify_water",
      label: "Purify Water",
      inputs: [{ itemId: "water", amount: 1 }],
      outputs: [{ itemId: "water", amount: 1 }],
      metadata: {},
    });
    expect(recipe.id).toBe("purify_water");

    const recipes = await listCraftingRecipes(root);
    expect(recipes).toHaveLength(1);
  });
});
