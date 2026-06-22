import path from "node:path";
import type { ClothingPack, Workspace } from "@fdt/schemas";
import { createClothingPack, listClothingPacks, upsertClothingPack } from "./clothing-store.js";
import { discoverResourceNames } from "./detect-framework.js";
import { isLikelyClothingResource, scanClothingPack } from "./scan-clothing-pack.js";

export interface RefreshClothingPacksOptions {
  workspaceRoot: string;
  workspace: Workspace;
  discover?: boolean;
}

export async function refreshClothingPacksForCi(
  options: RefreshClothingPacksOptions,
): Promise<ClothingPack[]> {
  const packs = await listClothingPacks(options.workspaceRoot);

  if (options.discover !== false) {
    const resourcesRoot = path.resolve(options.workspaceRoot, options.workspace.resourcesRoot);
    for (const resourceName of discoverResourceNames(resourcesRoot)) {
      if (!isLikelyClothingResource(resourceName)) {
        continue;
      }

      const existing = packs.find((pack) => pack.resourceName === resourceName);
      if (existing) {
        continue;
      }

      const created = await createClothingPack(options.workspaceRoot, {
        id: `pack_${resourceName}`,
        label: resourceName,
        resourceName,
        resourcePath: path.join(options.workspace.resourcesRoot, resourceName).replace(/\\/g, "/"),
      });
      packs.push(created);
    }
  }

  const scanned: ClothingPack[] = [];
  for (const pack of packs) {
    const result = await scanClothingPack({ workspaceRoot: options.workspaceRoot, pack });
    await upsertClothingPack(options.workspaceRoot, result.pack);
    scanned.push(result.pack);
  }

  return scanned;
}
