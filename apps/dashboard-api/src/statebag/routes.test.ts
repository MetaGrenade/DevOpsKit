import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { saveWorkspaceRegistry } from "../workspaces/registry-store.js";

describe("statebag routes", () => {
  const previousDataDir = process.env.FDT_DATA_DIR;

  afterEach(async () => {
    if (previousDataDir === undefined) {
      delete process.env.FDT_DATA_DIR;
    } else {
      process.env.FDT_DATA_DIR = previousDataDir;
    }
  });

  it("imports in-game state bag snapshots", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "fdt-api-statebag-"));
    const serverRoot = path.join(tempRoot, "server");
    const registryDir = await mkdtemp(path.join(os.tmpdir(), "fdt-api-statebag-registry-"));
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
          name: "State Bag API Server",
          workspaceDirectory: tempRoot,
          serverRoot,
          resourcesRoot: path.join(serverRoot, "resources"),
          serverCfg: path.join(serverRoot, "server.cfg"),
        },
      });
      expect(createWorkspaceResponse.statusCode).toBe(200);

      const importResponse = await app.inject({
        method: "POST",
        url: "/api/v1/statebag/import",
        payload: {
          schemaVersion: 1,
          exportedAt: "2026-06-21T12:00:00Z",
          resource: "fdt_devtools",
          snapshot: {
            schemaVersion: 1,
            exportedAt: "2026-06-21T12:00:00Z",
            target: { kind: "player", bagName: "player:1" },
            entries: [{ key: "job", value: "police" }],
            watchedKeys: ["job"],
          },
        },
      });
      expect(importResponse.statusCode).toBe(200);

      const listResponse = await app.inject({
        method: "GET",
        url: "/api/v1/statebag/snapshots",
      });
      expect(listResponse.statusCode).toBe(200);
      expect((listResponse.json() as { snapshots: unknown[] }).snapshots.length).toBe(1);
    } finally {
      await app.close();
      await rm(tempRoot, { recursive: true, force: true });
      await rm(registryDir, { recursive: true, force: true });
    }
  });
});
