import type { AdapterId } from "@fdt/schemas";
import { customJsonAdapter } from "./custom-json.js";
import { esxAdapter } from "./esx.js";
import { oxAppearanceAdapter } from "./ox-appearance.js";
import { oxInventoryAdapter } from "./ox-inventory.js";
import { qbcoreAdapter } from "./qbcore.js";
import { qboxAdapter } from "./qbox.js";
import type { FdtAdapter } from "./types.js";

const ADAPTERS: Record<AdapterId, FdtAdapter> = {
  "custom-json": customJsonAdapter,
  qbcore: qbcoreAdapter,
  qbox: qboxAdapter,
  esx: esxAdapter,
  "ox-inventory": oxInventoryAdapter,
  "ox-appearance": oxAppearanceAdapter,
};

export function listAdapters(): FdtAdapter[] {
  return Object.values(ADAPTERS);
}

export function getAdapter(id: AdapterId): FdtAdapter {
  const adapter = ADAPTERS[id];
  if (!adapter) {
    throw new Error(`Unknown adapter: ${id}`);
  }
  return adapter;
}

export function getRecommendedAdapterId(
  recommendedAdapters: AdapterId[],
): AdapterId {
  const priority: AdapterId[] = ["qbox", "ox-appearance", "ox-inventory", "qbcore", "esx", "custom-json"];
  for (const candidate of priority) {
    if (recommendedAdapters.includes(candidate)) {
      return candidate;
    }
  }
  return "custom-json";
}
