import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { saveWorkspaceRegistry } from "../workspaces/registry-store.js";

describe("environment routes", () => {
  const previousDataDir = process.env.FDT_DATA_DIR;

  afterEach(async () => {
    if (previousDataDir === undefined) {
      delete process.env.FDT_DATA_DIR;
    } else {
      process.env.FDT_DATA_DIR = previousDataDir;
    }
  });

  it("initializes profiles and generates cfg plus recipe", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "fdt-api-env-"));
    const serverRoot = path.join(tempRoot, "server");
    await mkdir(path.join(serverRoot, "resources", "demo"), { recursive: true });
    await writeFile(path.join(serverRoot, "resources", "demo", "fxmanifest.lua"), "fx_version 'cerulean'\n", "utf8");
    await writeFile(path.join(serverRoot, "server.cfg"), "ensure demo\n", "utf8");

    const registryDir = await mkdtemp(path.join(os.tmpdir(), "fdt-api-env-registry-"));
    process.env.FDT_DATA_DIR = registryDir;

    await saveWorkspaceRegistry({ schemaVersion: 1, activeWorkspaceId: null, workspaces: [] });
    const app = await buildApp();

    try {
      const createWorkspaceResponse = await app.inject({
        method: "POST",
        url: "/api/v1/workspaces",
        payload: {
          name: "Environment API Server",
          workspaceDirectory: tempRoot,
          serverRoot,
          resourcesRoot: path.join(serverRoot, "resources"),
          serverCfg: path.join(serverRoot, "server.cfg"),
        },
      });
      expect(createWorkspaceResponse.statusCode).toBe(200);

      const initResponse = await app.inject({
        method: "POST",
        url: "/api/v1/environment/init",
      });
      expect(initResponse.statusCode).toBe(200);
      const initPayload = initResponse.json() as { registry: { profiles: unknown[] } };
      expect(initPayload.registry.profiles.length).toBe(4);

      const cfgResponse = await app.inject({
        method: "POST",
        url: "/api/v1/environment/generate-cfg",
        payload: { env: "dev" },
      });
      expect(cfgResponse.statusCode).toBe(200);
      const cfgPayload = cfgResponse.json() as { ensureOrder: string[] };
      expect(cfgPayload.ensureOrder).toContain("demo");

      const recipeResponse = await app.inject({
        method: "POST",
        url: "/api/v1/environment/generate-recipe",
        payload: { env: "dev" },
      });
      expect(recipeResponse.statusCode).toBe(200);

      const diffResponse = await app.inject({
        method: "POST",
        url: "/api/v1/environment/diff",
        payload: { from: "dev", to: "production" },
      });
      expect(diffResponse.statusCode).toBe(200);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
      await rm(registryDir, { recursive: true, force: true });
    }
  });
});
