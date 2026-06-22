import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  deleteZone,
  importZoneExport,
  listZones,
  loadZoneRegistry,
  resolveZonesPath,
  upsertZone,
} from "./zone-store.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "fdt-zones-"));
  tempDirs.push(dir);
  return dir;
}

describe("zone-store", () => {
  it("creates, imports, and deletes zones on disk", async () => {
    const workspaceRoot = await makeWorkspace();

    await upsertZone(workspaceRoot, {
      id: "garage_main",
      label: "Main Garage",
      type: "box",
      purpose: "garage",
      coords: [{ x: 10, y: 20, z: 30 }],
      width: 5,
      length: 8,
      heading: 90,
      metadata: {},
    });

    const zones = await listZones(workspaceRoot);
    expect(zones).toHaveLength(1);
    expect(zones[0]?.id).toBe("garage_main");

    const result = await importZoneExport(workspaceRoot, {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      resource: "fdt_devtools",
      zones: [
        {
          id: "shop_1",
          label: "Corner Shop",
          type: "sphere",
          purpose: "shop",
          coords: [{ x: 1, y: 2, z: 3 }],
          radius: 3,
          metadata: {},
        },
      ],
    });

    expect(result.imported).toBe(1);
    expect(await listZones(workspaceRoot)).toHaveLength(2);

    const raw = await readFile(resolveZonesPath(workspaceRoot), "utf8");
    expect(raw).toContain("Corner Shop");

    await expect(loadZoneRegistry(workspaceRoot)).resolves.toMatchObject({
      schemaVersion: 1,
      zones: expect.arrayContaining([expect.objectContaining({ id: "shop_1" })]),
    });

    expect(await deleteZone(workspaceRoot, "garage_main")).toBe(true);
    expect(await listZones(workspaceRoot)).toHaveLength(1);
  });
});
