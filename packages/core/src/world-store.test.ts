import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { importWorldExport, listBlips, listDoors, listProps, upsertBlip } from "./world-store.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("world store", () => {
  it("stores blips and imports combined world exports", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "fdt-world-store-"));
    tempDirs.push(root);
    await mkdir(path.join(root, ".fdt", "world"), { recursive: true });

    await upsertBlip(root, {
      id: "shop_blip",
      label: "Shop Blip",
      sprite: 52,
      color: 2,
      scale: 0.8,
      coords: { x: 10, y: 20, z: 30 },
      shortRange: true,
      metadata: {},
    });

    expect((await listBlips(root)).some((blip) => blip.id === "shop_blip")).toBe(true);

    const result = await importWorldExport(root, {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      resource: "fdt_devtools",
      props: [
        {
          id: "bench_prop",
          label: "Workbench",
          model: "prop_tool_bench02",
          coords: { x: 1, y: 2, z: 3, w: 90 },
          metadata: {},
        },
      ],
      doors: [
        {
          id: "front_door",
          label: "Front Door",
          coords: { x: 4, y: 5, z: 6, w: 180 },
          locked: true,
          metadata: {},
        },
      ],
    });

    expect(result.importedProps).toBe(1);
    expect(result.importedDoors).toBe(1);
    expect((await listProps(root)).some((prop) => prop.id === "bench_prop")).toBe(true);
    expect((await listDoors(root)).some((door) => door.id === "front_door")).toBe(true);
  });
});
