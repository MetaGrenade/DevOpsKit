import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { saveWorkspaceRegistry } from "../workspaces/registry-store.js";

describe("map routes", () => {
  const previousDataDir = process.env.FDT_DATA_DIR;

  afterEach(async () => {
    if (previousDataDir === undefined) {
      delete process.env.FDT_DATA_DIR;
    } else {
      process.env.FDT_DATA_DIR = previousDataDir;
    }
  });

  it("scans map resources and writes audit reports", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "fdt-api-maps-"));
    const serverRoot = path.join(tempRoot, "server");
    const resourcePath = path.join(serverRoot, "resources", "[meta]", "meta_map_office");
    await mkdir(path.join(resourcePath, "data"), { recursive: true });
    await mkdir(path.join(resourcePath, "stream"), { recursive: true });
    await writeFile(path.join(resourcePath, "fxmanifest.lua"), "this_is_a_map 'yes'", "utf8");
    await writeFile(path.join(resourcePath, "stream", "office.ymap"), "", "utf8");
    await writeFile(
      path.join(resourcePath, "data", "entrances.json"),
      JSON.stringify({ schemaVersion: 1, entrances: [{ x: 1, y: 2, z: 3, h: 90 }] }),
      "utf8",
    );

    const registryDir = await mkdtemp(path.join(os.tmpdir(), "fdt-api-maps-registry-"));
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
          name: "Map API Server",
          workspaceDirectory: tempRoot,
          serverRoot,
          resourcesRoot: path.join(serverRoot, "resources"),
          serverCfg: path.join(serverRoot, "server.cfg"),
        },
      });
      expect(createWorkspaceResponse.statusCode).toBe(200);

      const scanResponse = await app.inject({
        method: "POST",
        url: "/api/v1/maps/scan",
        payload: {},
      });
      expect(scanResponse.statusCode).toBe(200);
      expect((scanResponse.json() as { streamFiles: number }).streamFiles).toBeGreaterThan(0);

      const auditResponse = await app.inject({
        method: "POST",
        url: "/api/v1/maps/audit",
      });
      expect(auditResponse.statusCode).toBe(200);

      const reportResponse = await app.inject({
        method: "GET",
        url: "/api/v1/reports/map-audit",
      });
      expect(reportResponse.statusCode).toBe(200);
    } finally {
      await app.close();
      await rm(tempRoot, { recursive: true, force: true });
      await rm(registryDir, { recursive: true, force: true });
    }
  });
});
