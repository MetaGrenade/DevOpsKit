import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { saveJobRegistry } from "@fdt/core";
import { buildApp } from "../app.js";
import { saveWorkspaceRegistry } from "../workspaces/registry-store.js";

describe("economy routes", () => {
  const previousDataDir = process.env.FDT_DATA_DIR;

  afterEach(async () => {
    if (previousDataDir === undefined) {
      delete process.env.FDT_DATA_DIR;
    } else {
      process.env.FDT_DATA_DIR = previousDataDir;
    }
  });

  it("simulates economy activities for the active workspace", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "fdt-api-economy-"));
    const serverRoot = path.join(tempRoot, "server");
    await saveJobRegistry(tempRoot, {
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      jobs: [
        {
          id: "mechanic",
          label: "Mechanic",
          type: "business",
          defaultDuty: false,
          grades: [{ id: "tech", level: 0, label: "Technician", payment: 1100, permissions: [] }],
          locations: [],
          metadata: {},
        },
      ],
    });

    const registryDir = await mkdtemp(path.join(os.tmpdir(), "fdt-api-economy-registry-"));
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
          name: "Economy API Server",
          workspaceDirectory: tempRoot,
          serverRoot,
          resourcesRoot: path.join(serverRoot, "resources"),
          serverCfg: path.join(serverRoot, "server.cfg"),
        },
      });
      expect(createWorkspaceResponse.statusCode).toBe(200);

      const simulateResponse = await app.inject({
        method: "POST",
        url: "/api/v1/economy/simulate",
        payload: { hours: 6 },
      });
      expect(simulateResponse.statusCode).toBe(200);
      expect((simulateResponse.json() as { report: { summary: { comparedActivities: number } } }).report.summary.comparedActivities).toBeGreaterThanOrEqual(3);
    } finally {
      await app.close();
      await rm(tempRoot, { recursive: true, force: true });
      await rm(registryDir, { recursive: true, force: true });
    }
  });
});
