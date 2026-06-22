import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { saveWorkspaceRegistry } from "../workspaces/registry-store.js";

describe("graph routes", () => {
  const previousDataDir = process.env.FDT_DATA_DIR;

  afterEach(async () => {
    if (previousDataDir === undefined) {
      delete process.env.FDT_DATA_DIR;
    } else {
      process.env.FDT_DATA_DIR = previousDataDir;
    }
  });

  it("builds and returns dependency graph reports", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "fdt-api-graph-"));
    const serverRoot = path.join(tempRoot, "server");
    const corePath = path.join(serverRoot, "resources", "meta_core");
    const inventoryPath = path.join(serverRoot, "resources", "meta_inventory");
    await mkdir(corePath, { recursive: true });
    await mkdir(inventoryPath, { recursive: true });
    await writeFile(
      path.join(corePath, "fxmanifest.lua"),
      "fx_version 'cerulean'\ndependency 'ox_lib'\nclient_script 'client.lua'",
      "utf8",
    );
    await writeFile(path.join(corePath, "client.lua"), "RegisterNetEvent('meta:test')", "utf8");
    await writeFile(path.join(inventoryPath, "fxmanifest.lua"), "dependency 'meta_core'", "utf8");
    await writeFile(path.join(serverRoot, "server.cfg"), "ensure meta_core\nensure meta_inventory", "utf8");

    const registryDir = await mkdtemp(path.join(os.tmpdir(), "fdt-api-graph-registry-"));
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
          name: "Graph API Server",
          workspaceDirectory: tempRoot,
          serverRoot,
          resourcesRoot: path.join(serverRoot, "resources"),
          serverCfg: path.join(serverRoot, "server.cfg"),
        },
      });
      expect(createWorkspaceResponse.statusCode).toBe(200);

      const buildResponse = await app.inject({
        method: "POST",
        url: "/api/v1/graph/build",
      });
      expect(buildResponse.statusCode).toBe(200);
      expect((buildResponse.json() as { report: { summary: { edges: number } } }).report.summary.edges).toBeGreaterThan(0);

      const impactResponse = await app.inject({
        method: "GET",
        url: "/api/v1/graph/impacted?resource=meta_core",
      });
      expect(impactResponse.statusCode).toBe(200);
      expect((impactResponse.json() as { impact: { directDependents: string[] } }).impact.directDependents).toContain(
        "meta_inventory",
      );
    } finally {
      await app.close();
      await rm(tempRoot, { recursive: true, force: true });
      await rm(registryDir, { recursive: true, force: true });
    }
  });
});
