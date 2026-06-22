import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadWorkspaceConfig } from "./workspace.js";
import { checkWorkspacePaths, createWorkspaceOnDisk } from "./workspace-manager.js";

describe("createWorkspaceOnDisk", () => {
  it("creates fdt.workspace.json and output folders in an external directory", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "fdt-workspace-"));

    try {
      const serverRoot = path.join(tempRoot, "server");
      const result = await createWorkspaceOnDisk({
        name: "External Test Server",
        workspaceDirectory: tempRoot,
        serverRoot,
        resourcesRoot: path.join(serverRoot, "resources"),
        serverCfg: path.join(serverRoot, "server.cfg"),
      });

      expect(existsSync(result.configPath)).toBe(true);
      expect(existsSync(path.join(tempRoot, ".fdt", "reports"))).toBe(true);

      const loaded = await loadWorkspaceConfig({ workspaceRoot: tempRoot });
      expect(loaded.status).toBe("found");
      if (loaded.status === "found") {
        expect(loaded.workspace.name).toBe("External Test Server");
      }
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});

describe("checkWorkspacePaths", () => {
  it("reports missing paths without throwing", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "fdt-check-"));

    try {
      const created = await createWorkspaceOnDisk({
        name: "Path Check Server",
        workspaceDirectory: tempRoot,
        serverRoot: path.join(tempRoot, "missing-server"),
        resourcesRoot: path.join(tempRoot, "missing-server", "resources"),
        serverCfg: path.join(tempRoot, "missing-server", "server.cfg"),
      });

      const checks = checkWorkspacePaths(tempRoot, created.workspace);
      expect(checks.pathChecks.workspaceDirectory).toBe(true);
      expect(checks.pathChecks.resourcesRoot).toBe(false);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});
