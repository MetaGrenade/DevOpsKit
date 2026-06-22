import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { saveWorkspaceRegistry } from "../workspaces/registry-store.js";

describe("world routes", () => {
  const previousDataDir = process.env.FDT_DATA_DIR;

  afterEach(async () => {
    if (previousDataDir === undefined) {
      delete process.env.FDT_DATA_DIR;
    } else {
      process.env.FDT_DATA_DIR = previousDataDir;
    }
  });

  it("imports blips, props, and doors from devtools export", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "fdt-api-world-"));
    const serverRoot = path.join(tempRoot, "server");
    await mkdir(serverRoot, { recursive: true });
    await writeFile(path.join(serverRoot, ".fxserver-artifact-version"), "29753\n", "utf8");

    const registryDir = await mkdtemp(path.join(os.tmpdir(), "fdt-api-world-registry-"));
    process.env.FDT_DATA_DIR = registryDir;

    await saveWorkspaceRegistry({ schemaVersion: 1, activeWorkspaceId: null, workspaces: [] });
    const app = await buildApp();

    try {
      const createWorkspaceResponse = await app.inject({
        method: "POST",
        url: "/api/v1/workspaces",
        payload: {
          name: "World API Server",
          workspaceDirectory: tempRoot,
          serverRoot,
          resourcesRoot: path.join(serverRoot, "resources"),
          serverCfg: path.join(serverRoot, "server.cfg"),
        },
      });
      expect(createWorkspaceResponse.statusCode).toBe(200);

      const importResponse = await app.inject({
        method: "POST",
        url: "/api/v1/world/import",
        payload: {
          schemaVersion: 1,
          exportedAt: new Date().toISOString(),
          resource: "fdt_devtools",
          blips: [
            {
              id: "store_blip",
              label: "Store",
              sprite: 52,
              color: 2,
              scale: 0.8,
              coords: { x: 1, y: 2, z: 3 },
              shortRange: true,
              metadata: {},
            },
          ],
          props: [
            {
              id: "bench",
              label: "Bench",
              model: "prop_tool_bench02",
              coords: { x: 4, y: 5, z: 6, w: 90 },
              metadata: {},
            },
          ],
        },
      });
      expect(importResponse.statusCode).toBe(200);
      const imported = importResponse.json() as { importedBlips: number; importedProps: number };
      expect(imported.importedBlips).toBe(1);
      expect(imported.importedProps).toBe(1);

      const blipsResponse = await app.inject({ method: "GET", url: "/api/v1/world/blips" });
      expect(blipsResponse.statusCode).toBe(200);
      const blips = blipsResponse.json() as { blips: Array<{ id: string }> };
      expect(blips.blips.some((blip) => blip.id === "store_blip")).toBe(true);
    } finally {
      await app.close();
      await rm(tempRoot, { recursive: true, force: true });
      await rm(registryDir, { recursive: true, force: true });
    }
  });
});
