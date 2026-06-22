import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { saveWorkspaceRegistry } from "../workspaces/registry-store.js";

describe("clothing routes", () => {
  const previousDataDir = process.env.FDT_DATA_DIR;

  afterEach(async () => {
    if (previousDataDir === undefined) {
      delete process.env.FDT_DATA_DIR;
    } else {
      process.env.FDT_DATA_DIR = previousDataDir;
    }
  });

  it("creates packs, scans stream assets, and validates conflicts", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "fdt-api-clothing-"));
    const serverRoot = path.join(tempRoot, "server");
    const resourcePath = path.join(serverRoot, "resources", "[meta]", "meta_clothing_a");
    await mkdir(path.join(resourcePath, "stream"), { recursive: true });
    await writeFile(path.join(resourcePath, "stream", "mp_m_freemode_01^meta_jacket_001.ydd"), "ydd", "utf8");
    await writeFile(path.join(resourcePath, "stream", "mp_m_freemode_01^meta_jacket_001.ytd"), "ytd", "utf8");

    const registryDir = await mkdtemp(path.join(os.tmpdir(), "fdt-api-clothing-registry-"));
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
          name: "Clothing API Server",
          workspaceDirectory: tempRoot,
          serverRoot,
          resourcesRoot: path.join(serverRoot, "resources"),
          serverCfg: path.join(serverRoot, "server.cfg"),
        },
      });
      expect(createWorkspaceResponse.statusCode).toBe(200);

      const createPackResponse = await app.inject({
        method: "POST",
        url: "/api/v1/clothing/packs/new",
        payload: {
          id: "pack_api_a",
          label: "API Pack A",
          resourceName: "meta_clothing_a",
          resourcePath: "server/resources/[meta]/meta_clothing_a",
        },
      });
      expect(createPackResponse.statusCode).toBe(200);

      const scanResponse = await app.inject({
        method: "POST",
        url: "/api/v1/clothing/scan",
        payload: { packId: "pack_api_a" },
      });
      expect(scanResponse.statusCode).toBe(200);
      expect(
        (scanResponse.json() as { results: Array<{ pack: { drawables: unknown[] } }> }).results[0]?.pack
          .drawables.length,
      ).toBeGreaterThan(0);

      const conflictsResponse = await app.inject({
        method: "POST",
        url: "/api/v1/clothing/conflicts",
      });
      expect(conflictsResponse.statusCode).toBe(200);

      const reportResponse = await app.inject({
        method: "GET",
        url: "/api/v1/reports/clothing-conflicts",
      });
      expect(reportResponse.statusCode).toBe(200);
    } finally {
      await app.close();
      await rm(tempRoot, { recursive: true, force: true });
      await rm(registryDir, { recursive: true, force: true });
    }
  });
});
