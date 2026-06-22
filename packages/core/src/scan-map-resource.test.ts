import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanMapResource, scanWorkspaceMaps, syncMapRegistryFromScan } from "./scan-map-resource.js";
import { listMapPackages } from "./map-store.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("scanWorkspaceMaps", () => {
  it("excludes vehicle-only resources during workspace discovery", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "fdt-map-discover-"));
    tempDirs.push(root);

    const vehicleRoot = path.join(root, "server", "resources", "[meta]", "meta_vehicles");
    await mkdir(path.join(vehicleRoot, "data"), { recursive: true });
    await mkdir(path.join(vehicleRoot, "stream"), { recursive: true });
    await writeFile(path.join(vehicleRoot, "fxmanifest.lua"), "fx_version 'cerulean'", "utf8");
    await writeFile(path.join(vehicleRoot, "data", "vehicles.meta"), "<vehicles />", "utf8");
    await writeFile(path.join(vehicleRoot, "stream", "meta_cvpi.yft"), "", "utf8");

    const mapRoot = path.join(root, "server", "resources", "[meta]", "meta_map_office");
    await mkdir(path.join(mapRoot, "stream"), { recursive: true });
    await writeFile(path.join(mapRoot, "fxmanifest.lua"), "this_is_a_map 'yes'", "utf8");
    await writeFile(path.join(mapRoot, "stream", "office.ymap"), "", "utf8");

    const results = await scanWorkspaceMaps({
      workspaceRoot: root,
      resourcesRoot: "server/resources",
      discover: true,
    });

    expect(results.map((entry) => entry.resourceName)).toEqual(["meta_map_office"]);
  });
});

describe("scanMapResource", () => {
  it("indexes stream assets and data files from a map resource", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "fdt-map-scan-"));
    tempDirs.push(root);

    const resourceRoot = path.join(root, "server", "resources", "[meta]", "meta_map_office");
    await mkdir(path.join(resourceRoot, "data"), { recursive: true });
    await mkdir(path.join(resourceRoot, "stream"), { recursive: true });
    await writeFile(path.join(resourceRoot, "fxmanifest.lua"), "this_is_a_map 'yes'", "utf8");
    await writeFile(path.join(resourceRoot, "stream", "office.ymap"), "", "utf8");
    await writeFile(
      path.join(resourceRoot, "data", "entrances.json"),
      JSON.stringify({ schemaVersion: 1, entrances: [{ x: 1, y: 2, z: 3, h: 90 }] }),
      "utf8",
    );

    const result = await scanMapResource({
      workspaceRoot: root,
      resourceName: "meta_map_office",
      resourcesRoot: "server/resources",
    });

    expect(result?.hasManifest).toBe(true);
    expect(result?.streamCounts.ymap).toBe(1);
    expect(result?.entrances).toHaveLength(1);
  });

  it("registers scanned resources with sanitized map ids", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "fdt-map-sync-"));
    tempDirs.push(root);

    const resourceRoot = path.join(root, "server", "resources", "[maps]", "Eminent-MLO-Pack");
    await mkdir(path.join(resourceRoot, "stream"), { recursive: true });
    await writeFile(path.join(resourceRoot, "fxmanifest.lua"), "this_is_a_map 'yes'", "utf8");
    await writeFile(path.join(resourceRoot, "stream", "pack.ymap"), "", "utf8");

    const scanned = await scanMapResource({
      workspaceRoot: root,
      resourceName: "Eminent-MLO-Pack",
      resourcesRoot: "server/resources",
    });
    expect(scanned).not.toBeNull();

    const mapPackage = await syncMapRegistryFromScan(root, scanned!);
    expect(mapPackage.id).toBe("eminent_mlo_pack");

    const maps = await listMapPackages(root);
    expect(maps.some((entry) => entry.id === "eminent_mlo_pack")).toBe(true);
  });
});
