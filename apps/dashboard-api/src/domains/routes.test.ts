import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { saveWorkspaceRegistry } from "../workspaces/registry-store.js";

describe("domain routes", () => {
  const previousDataDir = process.env.FDT_DATA_DIR;

  afterEach(async () => {
    if (previousDataDir === undefined) {
      delete process.env.FDT_DATA_DIR;
    } else {
      process.env.FDT_DATA_DIR = previousDataDir;
    }
  });

  it("manages vehicles, businesses from zones, and map checklists", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "fdt-api-domain-"));
    const serverRoot = path.join(tempRoot, "server");
    await mkdir(path.join(serverRoot, "resources"), { recursive: true });
    await mkdir(path.join(tempRoot, ".fdt", "zones"), { recursive: true });
    await writeFile(
      path.join(tempRoot, ".fdt", "zones", "zones.json"),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          updatedAt: new Date().toISOString(),
          zones: [
            {
              id: "api_shop_zone",
              label: "API Shop",
              type: "sphere",
              purpose: "shop",
              coords: [{ x: 1, y: 2, z: 3 }],
              metadata: {},
            },
            {
              id: "api_job_zone",
              label: "API Job Duty",
              type: "sphere",
              purpose: "job",
              coords: [{ x: 10, y: 11, z: 12 }],
              metadata: {},
            },
            {
              id: "api_territory_zone",
              label: "API Territory",
              type: "sphere",
              purpose: "territory",
              coords: [{ x: 20, y: 21, z: 22 }],
              metadata: {},
            },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const registryDir = await mkdtemp(path.join(os.tmpdir(), "fdt-api-domain-registry-"));
    process.env.FDT_DATA_DIR = registryDir;

    await saveWorkspaceRegistry({
      schemaVersion: 1,
      activeWorkspaceId: null,
      workspaces: [],
    });

    const app = await buildApp();

    try {
      const createWorkspaceResponse = await app.inject({
        method: "POST",
        url: "/api/v1/workspaces",
        payload: {
          name: "Domain API Server",
          workspaceDirectory: tempRoot,
          serverRoot,
          resourcesRoot: path.join(serverRoot, "resources"),
          serverCfg: path.join(serverRoot, "server.cfg"),
        },
      });
      expect(createWorkspaceResponse.statusCode).toBe(200);

      const vehicleResponse = await app.inject({
        method: "POST",
        url: "/api/v1/domains/vehicles",
        payload: {
          spawnName: "meta_test_car",
          displayName: "Meta Test Car",
          category: "car",
          metadata: {},
        },
      });
      expect(vehicleResponse.statusCode).toBe(200);

      const businessResponse = await app.inject({
        method: "POST",
        url: "/api/v1/domains/businesses/from-zone",
        payload: { zoneId: "api_shop_zone" },
      });
      expect(businessResponse.statusCode).toBe(200);

      const jobResponse = await app.inject({
        method: "POST",
        url: "/api/v1/domains/jobs/from-zone",
        payload: { zoneId: "api_job_zone" },
      });
      expect(jobResponse.statusCode).toBe(200);

      const gangResponse = await app.inject({
        method: "POST",
        url: "/api/v1/domains/gangs/from-zone",
        payload: { zoneId: "api_territory_zone" },
      });
      expect(gangResponse.statusCode).toBe(200);

      const mapResponse = await app.inject({
        method: "POST",
        url: "/api/v1/domains/maps/new",
        payload: {
          id: "meta_map_api",
          label: "API Map",
          resourceName: "meta_map_api",
        },
      });
      expect(mapResponse.statusCode).toBe(200);

      const exportResponse = await app.inject({
        method: "POST",
        url: "/api/v1/domains/export",
        payload: { adapter: "custom-json", dryRun: true },
      });
      expect(exportResponse.statusCode).toBe(200);
      const exported = exportResponse.json() as { files: Array<{ relativePath: string }> };
      expect(exported.files.some((file) => file.relativePath === "vehicles.json")).toBe(true);
      expect(exported.files.some((file) => file.relativePath === "businesses.json")).toBe(true);
      expect(exported.files.some((file) => file.relativePath === "jobs.json")).toBe(true);
      expect(exported.files.some((file) => file.relativePath === "gangs.json")).toBe(true);
      expect(exported.files.some((file) => file.relativePath === "maps.json")).toBe(true);
    } finally {
      await app.close();
      await rm(tempRoot, { recursive: true, force: true });
      await rm(registryDir, { recursive: true, force: true });
    }
  });
});
