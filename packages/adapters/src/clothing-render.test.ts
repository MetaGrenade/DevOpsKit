import { describe, expect, it } from "vitest";
import type { FdtDomainModel } from "@fdt/schemas";
import {
  buildClothingShopEntries,
  renderClothingShopJson,
  renderEsxClothingCatalogJson,
  renderQbClothingCatalogLua,
} from "./clothing-render.js";
import { customJsonAdapter } from "./custom-json.js";
import { esxAdapter } from "./esx.js";
import { qbcoreAdapter } from "./qbcore.js";
import { qboxAdapter } from "./qbox.js";

const clothingModel: FdtDomainModel = {
  items: [],
  vehicles: [],
  businesses: [],
  maps: [],
  jobs: [],
  gangs: [],
  clothingPacks: [
    {
      id: "pack_a",
      label: "Pack A",
      resourceName: "meta_clothing_a",
      genderScope: "shared",
      status: "scanned",
      tags: ["seasonal"],
      drawables: [
        {
          id: "drw_jacket",
          label: "Jacket",
          category: "tops",
          componentId: 11,
          drawableId: 3,
          gender: "male",
          fileName: "jacket.ydd",
          relativePath: "stream/jacket.ydd",
          textures: [
            {
              id: "tex_black",
              textureId: 0,
              label: "Black",
              fileName: "jacket_black.ytd",
              relativePath: "stream/jacket_black.ytd",
            },
          ],
          restrictedJobs: ["police"],
          restrictedGangs: [],
          tags: [],
        },
      ],
      metadata: {},
    },
  ],
  shops: [],
  craftingRecipes: [],
};

const generatedAt = "2026-06-21T00:00:00.000Z";

describe("clothing shop exports", () => {
  it("builds flattened shop entries with texture variants", () => {
    const entries = buildClothingShopEntries(clothingModel);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: "pack_a:drw_jacket:0",
      packId: "pack_a",
      label: "Black",
      category: "tops",
      resourceName: "meta_clothing_a",
      textureId: 0,
      restrictedJobs: ["police"],
    });
  });

  it("exports clothing-shop.json through custom-json adapter", async () => {
    const result = await customJsonAdapter.export(clothingModel, { generatedAt });
    const shopFile = result.files.find((file) => file.relativePath === "clothing-shop.json");
    expect(shopFile?.content).toContain('"entries"');
    expect(renderClothingShopJson(clothingModel, generatedAt)).toBe(shopFile?.content);
  });

  it("exports qbcore clothing catalog lua", async () => {
    const result = await qbcoreAdapter.export(clothingModel, { generatedAt });
    const catalog = result.files.find((file) => file.relativePath === "shared/clothing_catalog.lua");
    expect(catalog?.content).toContain("FDTClothingCatalog.Entries");
    expect(catalog?.content).toContain("restrictedJobs = { 'police' }");
    expect(renderQbClothingCatalogLua(clothingModel, generatedAt)).toBe(catalog?.content);
  });

  it("exports ox-appearance clothing json for component-based shops", async () => {
    const { oxAppearanceAdapter } = await import("./ox-appearance.js");
    const result = await oxAppearanceAdapter.export(clothingModel, { generatedAt });

    expect(result.files.map((file) => file.relativePath)).toEqual([
      "ox_appearance/data/fdt_clothing.json",
      "illenium-appearance/shared/fdt_clothing.json",
    ]);
    expect(result.files[0]?.content).toContain('"framework": "ox-appearance"');
    expect(result.files[0]?.content).toContain('"components"');
  });

  it("exports qbox clothing catalog lua", async () => {
    const result = await qboxAdapter.export(clothingModel, { generatedAt });
    const catalog = result.files.find((file) => file.relativePath === "qbx_core/shared/fdt_clothing_catalog.lua");
    expect(catalog?.content).toContain("Adapter: qbox");
    expect(catalog?.content).toContain("FDTClothingCatalog.Entries");
  });
});
