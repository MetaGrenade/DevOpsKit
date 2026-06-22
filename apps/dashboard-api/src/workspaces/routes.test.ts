import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { saveWorkspaceRegistry } from "./registry-store.js";

describe("workspace routes", () => {
  const previousDataDir = process.env.FDT_DATA_DIR;

  afterEach(async () => {
    if (previousDataDir === undefined) {
      delete process.env.FDT_DATA_DIR;
    } else {
      process.env.FDT_DATA_DIR = previousDataDir;
    }
  });

  it("creates and selects an external workspace", async () => {
      const tempRoot = await mkdtemp(path.join(os.tmpdir(), "fdt-api-workspace-"));
      const serverRoot = path.join(tempRoot, "server");
      await mkdir(serverRoot, { recursive: true });
      await writeFile(path.join(serverRoot, ".fxserver-artifact-version"), "29753\n", "utf8");
      const registryDir = await mkdtemp(path.join(os.tmpdir(), "fdt-api-registry-"));
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
          name: "External API Server",
          workspaceDirectory: tempRoot,
          serverRoot,
          resourcesRoot: path.join(serverRoot, "resources"),
          serverCfg: path.join(serverRoot, "server.cfg"),
        },
      });

      expect(createResponse.statusCode).toBe(200);
      const created = createResponse.json() as { workspace: { id: string; directory: string } };
      expect(created.workspace.directory).toBe(path.resolve(tempRoot));

      const listResponse = await app.inject({
        method: "GET",
        url: "/api/v1/workspaces",
      });
      expect(listResponse.statusCode).toBe(200);
      const listed = listResponse.json() as {
        activeWorkspaceId: string;
        workspaces: Array<{ serverArtifact?: { build: number; source: string } }>;
      };
      expect(listed.activeWorkspaceId).toBe(created.workspace.id);
      expect(listed.workspaces.length).toBeGreaterThan(0);

      const external = listed.workspaces.find((workspace) => workspace.serverArtifact?.build === 29_753);
      expect(external?.serverArtifact).toEqual({
        build: 29_753,
        source: "fxserver-artifact-version",
        path: "server/.fxserver-artifact-version",
      });
    } finally {
      await app.close();
      await rm(tempRoot, { recursive: true, force: true });
      await rm(registryDir, { recursive: true, force: true });
    }
  });
});
