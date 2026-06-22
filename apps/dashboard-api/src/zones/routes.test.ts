import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { saveWorkspaceRegistry } from "../workspaces/registry-store.js";

describe("zone routes", () => {
  const previousDataDir = process.env.FDT_DATA_DIR;

  afterEach(async () => {
    if (previousDataDir === undefined) {
      delete process.env.FDT_DATA_DIR;
    } else {
      process.env.FDT_DATA_DIR = previousDataDir;
    }
  });

  it("imports exported zones into the active workspace", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "fdt-api-zones-"));
    const serverRoot = path.join(tempRoot, "server");
    await mkdir(serverRoot, { recursive: true });
    await writeFile(path.join(serverRoot, ".fxserver-artifact-version"), "29753\n", "utf8");
    const registryDir = await mkdtemp(path.join(os.tmpdir(), "fdt-api-zones-registry-"));
    process.env.FDT_DATA_DIR = registryDir;

    await saveWorkspaceRegistry({
      schemaVersion: 1,
      activeWorkspaceId: null,
      workspaces: [],
    });

    const app = await buildApp();

    try {
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/v1/workspaces",
        payload: {
          name: "Zone Import Server",
          workspaceDirectory: tempRoot,
          serverRoot,
          resourcesRoot: path.join(serverRoot, "resources"),
          serverCfg: path.join(serverRoot, "server.cfg"),
        },
      });
      expect(createResponse.statusCode).toBe(200);

      const importResponse = await app.inject({
        method: "POST",
        url: "/api/v1/zones/import",
        payload: {
          schemaVersion: 1,
          exportedAt: new Date().toISOString(),
          exportedBy: "license:test",
          resource: "fdt_devtools",
          zones: [
            {
              id: "shop_downtown",
              label: "Downtown Shop",
              type: "sphere",
              purpose: "shop",
              coords: [{ x: 100.5, y: -200.25, z: 30.0 }],
              radius: 2.5,
              metadata: {},
            },
          ],
        },
      });

      expect(importResponse.statusCode).toBe(200);
      const imported = importResponse.json() as { imported: number; zones: Array<{ id: string }> };
      expect(imported.imported).toBe(1);
      expect(imported.zones.some((zone) => zone.id === "shop_downtown")).toBe(true);

      const listResponse = await app.inject({
        method: "GET",
        url: "/api/v1/zones",
      });
      expect(listResponse.statusCode).toBe(200);
      const listed = listResponse.json() as { zones: Array<{ id: string; label: string }> };
      expect(listed.zones).toHaveLength(1);
      expect(listed.zones[0]?.label).toBe("Downtown Shop");
    } finally {
      await app.close();
      await rm(tempRoot, { recursive: true, force: true });
      await rm(registryDir, { recursive: true, force: true });
    }
  });
});
