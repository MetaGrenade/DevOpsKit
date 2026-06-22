import { describe, expect, it } from "vitest";
import type { FdtDomainModel } from "@fdt/schemas";
import { qboxAdapter } from "./qbox.js";
import { renderVehicleShopJson } from "./vehicle-render.js";
import { customJsonAdapter } from "./custom-json.js";

const model: FdtDomainModel = {
  items: [],
  vehicles: [
    {
      spawnName: "meta_cvpi",
      displayName: "Meta CVPI",
      category: "emergency",
      price: 0,
      shop: "police_fleet",
      emergency: true,
      restrictedJobs: ["police"],
      metadata: { resourceName: "meta_vehicles" },
    },
  ],
  businesses: [],
  maps: [],
  jobs: [],
  gangs: [],
  clothingPacks: [],
  shops: [],
  craftingRecipes: [],
};

const generatedAt = "2026-06-21T00:00:00.000Z";

describe("vehicle shop exports", () => {
  it("exports vehicle-shop.json through custom-json adapter", async () => {
    const result = await customJsonAdapter.export(model, { generatedAt });
    const shop = result.files.find((file) => file.relativePath === "vehicle-shop.json");
    expect(shop?.content).toBe(renderVehicleShopJson(model, generatedAt));
  });

  it("exports qbox vehicle shop lua", async () => {
    const result = await qboxAdapter.export(model, { generatedAt });
    const shop = result.files.find((file) => file.relativePath === "qbx_core/shared/fdt_vehicle_shop.lua");
    expect(shop?.content).toContain("FDTVehicleShop.Entries");
    expect(shop?.content).toContain("restrictedJobs = { 'police' }");
  });
});
