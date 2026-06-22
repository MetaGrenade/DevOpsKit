import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  BusinessRegistrySchema,
  BusinessSchema,
  BusinessTypeSchema,
  ZonePurposeSchema,
  type Business,
  type BusinessRegistry,
  type Zone,
} from "@fdt/schemas";
import { FDT_BUSINESSES_FILE } from "./workspace.js";
import { loadZoneRegistry } from "./zone-store.js";

function emptyRegistry(): BusinessRegistry {
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    businesses: [],
  };
}

export function resolveBusinessesPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, FDT_BUSINESSES_FILE);
}

export async function loadBusinessRegistry(workspaceRoot: string): Promise<BusinessRegistry> {
  const businessesPath = resolveBusinessesPath(workspaceRoot);
  if (!existsSync(businessesPath)) {
    return emptyRegistry();
  }

  const raw = await readFile(businessesPath, "utf8");
  return BusinessRegistrySchema.parse(JSON.parse(raw));
}

export async function saveBusinessRegistry(
  workspaceRoot: string,
  registry: BusinessRegistry,
): Promise<string> {
  const businessesPath = resolveBusinessesPath(workspaceRoot);
  await mkdir(path.dirname(businessesPath), { recursive: true });

  const payload: BusinessRegistry = {
    ...registry,
    updatedAt: new Date().toISOString(),
  };

  await writeFile(businessesPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return businessesPath;
}

export async function listBusinesses(workspaceRoot: string): Promise<Business[]> {
  const registry = await loadBusinessRegistry(workspaceRoot);
  return registry.businesses;
}

export async function upsertBusiness(workspaceRoot: string, business: Business): Promise<Business> {
  const parsed = BusinessSchema.parse(business);
  const registry = await loadBusinessRegistry(workspaceRoot);
  const index = registry.businesses.findIndex((existing) => existing.id === parsed.id);

  if (index >= 0) {
    registry.businesses[index] = parsed;
  } else {
    registry.businesses.push(parsed);
  }

  registry.businesses.sort((a, b) => a.id.localeCompare(b.id));
  await saveBusinessRegistry(workspaceRoot, registry);
  return parsed;
}

export async function deleteBusiness(workspaceRoot: string, businessId: string): Promise<boolean> {
  const registry = await loadBusinessRegistry(workspaceRoot);
  const before = registry.businesses.length;
  registry.businesses = registry.businesses.filter((business) => business.id !== businessId);

  if (registry.businesses.length === before) {
    return false;
  }

  await saveBusinessRegistry(workspaceRoot, registry);
  return true;
}

const PURPOSE_TO_BUSINESS_TYPE: Record<string, Business["type"]> = {
  shop: "shop",
  stash: "stash",
  garage: "garage",
  territory: "territory",
  job: "job",
  interaction: "custom",
  event: "custom",
  custom: "custom",
};

export function mapZonePurposeToBusinessType(purpose: Zone["purpose"]): Business["type"] {
  const parsed = ZonePurposeSchema.parse(purpose);
  return PURPOSE_TO_BUSINESS_TYPE[parsed] ?? "custom";
}

export async function createBusinessFromZone(
  workspaceRoot: string,
  input: {
    zoneId: string;
    id?: string;
    label?: string;
    registerEnabled?: boolean;
    stashSlots?: number;
  },
): Promise<Business> {
  const zones = await loadZoneRegistry(workspaceRoot);
  const zone = zones.zones.find((item) => item.id === input.zoneId);
  if (!zone) {
    throw new Error(`Zone not found: ${input.zoneId}`);
  }

  const businessId = input.id ?? `biz_${zone.id}`;
  const businessType = mapZonePurposeToBusinessType(zone.purpose);
  BusinessTypeSchema.parse(businessType);

  const business = BusinessSchema.parse({
    id: businessId,
    label: input.label ?? zone.label,
    type: businessType,
    zoneId: zone.id,
    coords: zone.coords[0],
    registerEnabled: input.registerEnabled ?? zone.purpose === "shop",
    stashSlots: input.stashSlots ?? (zone.purpose === "stash" ? 50 : undefined),
    metadata: {
      sourceZonePurpose: zone.purpose,
      zoneType: zone.type,
    },
  });

  return upsertBusiness(workspaceRoot, business);
}
