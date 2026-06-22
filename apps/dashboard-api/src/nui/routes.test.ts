import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { saveWorkspaceRegistry } from "../workspaces/registry-store.js";
import { writeNuiResource } from "@fdt/core";

describe("nui routes", () => {
  const previousDataDir = process.env.FDT_DATA_DIR;

  afterEach(async () => {
    if (previousDataDir === undefined) {
      delete process.env.FDT_DATA_DIR;
    } else {
      process.env.FDT_DATA_DIR = previousDataDir;
    }
  });

  it("syncs and validates NUI schema bridge files", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "fdt-api-nui-"));
    const serverRoot = path.join(tempRoot, "server");
    await writeNuiResource({
      workspaceRoot: tempRoot,
      resourcesRoot: path.join("server", "resources"),
      resourceName: "meta_mdt",
      title: "Meta MDT",
    });

    const registryDir = await mkdtemp(path.join(os.tmpdir(), "fdt-api-nui-registry-"));
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
          name: "NUI API Server",
          workspaceDirectory: tempRoot,
          serverRoot,
          resourcesRoot: path.join(serverRoot, "resources"),
          serverCfg: path.join(serverRoot, "server.cfg"),
        },
      });
      expect(createWorkspaceResponse.statusCode).toBe(200);

      const listResponse = await app.inject({
        method: "GET",
        url: "/api/v1/nui",
      });
      expect(listResponse.statusCode).toBe(200);
      expect((listResponse.json() as { resources: unknown[] }).resources.length).toBeGreaterThan(0);

      const validateResponse = await app.inject({
        method: "POST",
        url: "/api/v1/nui/validate",
      });
      expect(validateResponse.statusCode).toBe(200);
      expect((validateResponse.json() as { passed: boolean }).passed).toBe(true);
    } finally {
      await app.close();
      await rm(tempRoot, { recursive: true, force: true });
      await rm(registryDir, { recursive: true, force: true });
    }
  });
});
