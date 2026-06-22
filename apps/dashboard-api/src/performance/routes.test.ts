import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { saveWorkspaceRegistry } from "../workspaces/registry-store.js";

describe("performance routes", () => {
  const previousDataDir = process.env.FDT_DATA_DIR;

  afterEach(async () => {
    if (previousDataDir === undefined) {
      delete process.env.FDT_DATA_DIR;
    } else {
      process.env.FDT_DATA_DIR = previousDataDir;
    }
  });

  it("imports snapshots, compares them, and summarizes release performance", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "fdt-api-perf-"));
    const serverRoot = path.join(tempRoot, "server");
    await mkdir(path.join(serverRoot, "resources"), { recursive: true });

    const registryDir = await mkdtemp(path.join(os.tmpdir(), "fdt-api-perf-registry-"));
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
          name: "Perf API Server",
          workspaceDirectory: tempRoot,
          serverRoot,
          resourcesRoot: path.join(serverRoot, "resources"),
          serverCfg: path.join(serverRoot, "server.cfg"),
        },
      });
      expect(createWorkspaceResponse.statusCode).toBe(200);

      const importResponse = await app.inject({
        method: "POST",
        url: "/api/v1/performance/snapshots/import",
        payload: {
          id: "perf_api_base",
          label: "API baseline",
          environment: "dev",
          capturedAt: "2025-06-01T12:00:00.000Z",
          resources: [{ resource: "meta_inventory", avgMs: 0.4, maxMs: 2.0 }],
        },
      });
      expect(importResponse.statusCode).toBe(200);

      const importTargetResponse = await app.inject({
        method: "POST",
        url: "/api/v1/performance/snapshots/import",
        payload: {
          id: "perf_api_target",
          label: "API target",
          releaseId: "rel_api_perf",
          environment: "dev",
          capturedAt: "2025-06-02T12:00:00.000Z",
          resources: [{ resource: "meta_inventory", avgMs: 0.55, maxMs: 2.4 }],
        },
      });
      expect(importTargetResponse.statusCode).toBe(200);

      const listResponse = await app.inject({
        method: "GET",
        url: "/api/v1/performance/snapshots",
      });
      expect(listResponse.statusCode).toBe(200);
      expect((listResponse.json() as { snapshots: unknown[] }).snapshots).toHaveLength(2);

      const compareResponse = await app.inject({
        method: "POST",
        url: "/api/v1/performance/compare",
        payload: {
          baselineSnapshotId: "perf_api_base",
          targetSnapshotId: "perf_api_target",
          thresholdPercent: 10,
        },
      });
      expect(compareResponse.statusCode).toBe(200);
      expect((compareResponse.json() as { report: { summary: { regressions: number } } }).report.summary.regressions).toBeGreaterThan(0);

      const reportResponse = await app.inject({
        method: "GET",
        url: "/api/v1/reports/performance-comparison",
      });
      expect(reportResponse.statusCode).toBe(200);

      const releasePerfResponse = await app.inject({
        method: "GET",
        url: "/api/v1/releases/rel_api_perf/performance",
      });
      expect(releasePerfResponse.statusCode).toBe(200);
      expect((releasePerfResponse.json() as { summary: { totalSnapshots: number } }).summary.totalSnapshots).toBe(1);
    } finally {
      await app.close();
      await rm(tempRoot, { recursive: true, force: true });
      await rm(registryDir, { recursive: true, force: true });
    }
  });
});
