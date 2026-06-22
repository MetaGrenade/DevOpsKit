import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { saveWorkspaceRegistry } from "../workspaces/registry-store.js";

describe("release routes", () => {
  const previousDataDir = process.env.FDT_DATA_DIR;

  afterEach(async () => {
    if (previousDataDir === undefined) {
      delete process.env.FDT_DATA_DIR;
    } else {
      process.env.FDT_DATA_DIR = previousDataDir;
    }
  });

  it("creates and updates release status for the active workspace", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "fdt-api-release-"));
    const serverRoot = path.join(tempRoot, "server");
    const resourcesRoot = path.join(serverRoot, "resources", "[meta]", "demo_resource");
    await mkdir(resourcesRoot, { recursive: true });
    await writeFile(path.join(resourcesRoot, "fxmanifest.lua"), "fx_version 'cerulean'\n", "utf8");
    await writeFile(path.join(serverRoot, ".fxserver-artifact-version"), "29753\n", "utf8");
    await mkdir(path.join(tempRoot, ".fdt", "reports"), { recursive: true });
    await writeFile(
      path.join(tempRoot, ".fdt", "reports", "resource-doctor.json"),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          generatedAt: new Date().toISOString(),
          workspaceName: "Release API Server",
          workspaceRoot: tempRoot,
          summary: {
            resourcesScanned: 1,
            errors: 0,
            warnings: 0,
            info: 0,
            passed: 1,
          },
          resources: [],
          serverCfg: { path: "server/server.cfg", started: [], ensured: [] },
          findings: [],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const registryDir = await mkdtemp(path.join(os.tmpdir(), "fdt-api-release-registry-"));
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
          name: "Release API Server",
          workspaceDirectory: tempRoot,
          serverRoot,
          resourcesRoot: path.join(serverRoot, "resources"),
          serverCfg: path.join(serverRoot, "server.cfg"),
        },
      });
      expect(createWorkspaceResponse.statusCode).toBe(200);

      const createReleaseResponse = await app.inject({
        method: "POST",
        url: "/api/v1/releases",
        payload: {
          version: "0.3.0",
          targetEnvironment: "staging",
        },
      });
      expect(createReleaseResponse.statusCode).toBe(200);
      const created = createReleaseResponse.json() as { release: { id: string; version: string } };
      expect(created.release.version).toBe("0.3.0");

      const statusResponse = await app.inject({
        method: "PATCH",
        url: `/api/v1/releases/${created.release.id}/status`,
        payload: {
          status: "qa-approved",
          note: "Approved in API test",
        },
      });
      expect(statusResponse.statusCode).toBe(200);
      const updated = statusResponse.json() as { release: { status: string } };
      expect(updated.release.status).toBe("qa-approved");

      const listResponse = await app.inject({
        method: "GET",
        url: "/api/v1/releases",
      });
      expect(listResponse.statusCode).toBe(200);
      const listed = listResponse.json() as { releases: Array<{ version: string }> };
      expect(listed.releases.some((release) => release.version === "0.3.0")).toBe(true);

      const checklistResponse = await app.inject({
        method: "GET",
        url: `/api/v1/releases/${created.release.id}/checklist`,
      });
      expect(checklistResponse.statusCode).toBe(200);
      const checklist = checklistResponse.json() as { report: { passed: boolean; items: unknown[] } };
      expect(checklist.report.items.length).toBeGreaterThan(0);

      const bundleResponse = await app.inject({
        method: "POST",
        url: `/api/v1/releases/${created.release.id}/bundle`,
        payload: {},
      });
      expect(bundleResponse.statusCode).toBe(200);
      const bundle = bundleResponse.json() as { outputDir: string };
      expect(bundle.outputDir).toContain("0.3.0");
    } finally {
      await app.close();
      await rm(tempRoot, { recursive: true, force: true });
      await rm(registryDir, { recursive: true, force: true });
    }
  });
});
