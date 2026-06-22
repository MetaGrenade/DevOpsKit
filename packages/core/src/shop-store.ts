import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { ShopRegistrySchema, ShopSchema, type Shop, type ShopRegistry } from "@fdt/schemas";
import { FDT_SHOPS_FILE } from "./workspace.js";
import { loadZoneRegistry } from "./zone-store.js";

function emptyRegistry(): ShopRegistry {
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    shops: [],
  };
}

export function resolveShopsPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, FDT_SHOPS_FILE);
}

export async function loadShopRegistry(workspaceRoot: string): Promise<ShopRegistry> {
  const shopsPath = resolveShopsPath(workspaceRoot);
  if (!existsSync(shopsPath)) {
    return emptyRegistry();
  }

  const raw = await readFile(shopsPath, "utf8");
  return ShopRegistrySchema.parse(JSON.parse(raw));
}

export async function saveShopRegistry(workspaceRoot: string, registry: ShopRegistry): Promise<string> {
  const shopsPath = resolveShopsPath(workspaceRoot);
  await mkdir(path.dirname(shopsPath), { recursive: true });

  const payload: ShopRegistry = {
    ...registry,
    updatedAt: new Date().toISOString(),
  };

  await writeFile(shopsPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return shopsPath;
}

export async function listShops(workspaceRoot: string): Promise<Shop[]> {
  const registry = await loadShopRegistry(workspaceRoot);
  return registry.shops;
}

export async function upsertShop(workspaceRoot: string, shop: Shop): Promise<Shop> {
  const parsed = ShopSchema.parse(shop);
  const registry = await loadShopRegistry(workspaceRoot);
  const index = registry.shops.findIndex((existing) => existing.id === parsed.id);

  if (index >= 0) {
    registry.shops[index] = parsed;
  } else {
    registry.shops.push(parsed);
  }

  registry.shops.sort((a, b) => a.id.localeCompare(b.id));
  await saveShopRegistry(workspaceRoot, registry);
  return parsed;
}

export async function deleteShop(workspaceRoot: string, shopId: string): Promise<boolean> {
  const registry = await loadShopRegistry(workspaceRoot);
  const before = registry.shops.length;
  registry.shops = registry.shops.filter((shop) => shop.id !== shopId);

  if (registry.shops.length === before) {
    return false;
  }

  await saveShopRegistry(workspaceRoot, registry);
  return true;
}

export async function createShopFromZone(
  workspaceRoot: string,
  input: {
    zoneId: string;
    id?: string;
    label?: string;
    type?: Shop["type"];
  },
): Promise<Shop> {
  const zones = await loadZoneRegistry(workspaceRoot);
  const zone = zones.zones.find((item) => item.id === input.zoneId);
  if (!zone) {
    throw new Error(`Zone not found: ${input.zoneId}`);
  }

  const coord = zone.coords[0];
  const shop = ShopSchema.parse({
    id: input.id ?? `shop_${zone.id}`,
    label: input.label ?? zone.label,
    type: input.type ?? (zone.purpose === "shop" ? "general" : "custom"),
    locations: coord
      ? [
          {
            coords: { x: coord.x, y: coord.y, z: coord.z },
            radius: zone.radius,
            zoneId: zone.id,
          },
        ]
      : [],
    items: [],
    metadata: {
      sourceZonePurpose: zone.purpose,
      zoneType: zone.type,
    },
  });

  return upsertShop(workspaceRoot, shop);
}
