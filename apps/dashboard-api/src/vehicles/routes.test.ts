import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { saveWorkspaceRegistry } from "../workspaces/registry-store.js";

describe("vehicle routes", () => {
  const previousDataDir = process.env.FDT_DATA_DIR;

  afterEach(async () => {
    if (previousDataDir === undefined) {
      delete process.env.FDT_DATA_DIR;
    } else {
      process.env.FDT_DATA_DIR = previousDataDir;
    }
  });

  it("scans vehicle resources and writes audit reports", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "fdt-api-vehicles-"));
    const serverRoot = path.join(tempRoot, "server");
    const resourcePath = path.join(serverRoot, "resources", "[meta]", "meta_vehicles");
    await mkdir(path.join(resourcePath, "data"), { recursive: true });
    await mkdir(path.join(resourcePath, "stream"), { recursive: true });
    await writeFile(
      path.join(resourcePath, "data", "vehicles.meta"),
      `<?xml version="1.0" encoding="UTF-8"?><CVehicleModelInfo__InitDataList><InitDatas><Item><modelName>meta_cvpi</modelName><gameName>CVPI</gameName><vehicleMakeName>Vapid</vehicleMakeName></Item></InitDatas></CVehicleModelInfo__InitDataList>`,
      "utf8",
    );
    await writeFile(path.join(resourcePath, "data", "handling.meta"), "<CHandlingDataMgr></CHandlingDataMgr>", "utf8");
    await writeFile(path.join(resourcePath, "stream", "meta_cvpi.yft"), "", "utf8");

    const registryDir = await mkdtemp(path.join(os.tmpdir(), "fdt-api-vehicles-registry-"));
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
          name: "Vehicle API Server",
          workspaceDirectory: tempRoot,
          serverRoot,
          resourcesRoot: path.join(serverRoot, "resources"),
          serverCfg: path.join(serverRoot, "server.cfg"),
        },
      });
      expect(createWorkspaceResponse.statusCode).toBe(200);

      const scanResponse = await app.inject({
        method: "POST",
        url: "/api/v1/vehicles/scan",
        payload: {},
      });
      expect(scanResponse.statusCode).toBe(200);
      expect((scanResponse.json() as { vehiclesIndexed: number }).vehiclesIndexed).toBeGreaterThan(0);

      const auditResponse = await app.inject({
        method: "POST",
        url: "/api/v1/vehicles/audit",
      });
      expect(auditResponse.statusCode).toBe(200);

      const reportResponse = await app.inject({
        method: "GET",
        url: "/api/v1/reports/vehicle-audit",
      });
      expect(reportResponse.statusCode).toBe(200);
    } finally {
      await app.close();
      await rm(tempRoot, { recursive: true, force: true });
      await rm(registryDir, { recursive: true, force: true });
    }
  });
});
