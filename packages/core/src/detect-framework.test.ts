import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { detectFrameworkProfile, discoverResourceNames } from "./detect-framework.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeResourcesTree(structure: Record<string, string[]>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fdt-fw-detect-"));
  tempDirs.push(root);

  for (const [folder, children] of Object.entries(structure)) {
    const folderPath = path.join(root, folder);
    await mkdir(folderPath, { recursive: true });
    for (const child of children) {
      await mkdir(path.join(folderPath, child), { recursive: true });
    }
  }

  return root;
}

describe("discoverResourceNames", () => {
  it("finds resources inside category folders", async () => {
    const resourcesRoot = await makeResourcesTree({
      "[qbx]": ["qbx_core", "qbx_smallresources"],
      "[ox]": ["ox_inventory", "ox_lib"],
    });

    const names = discoverResourceNames(resourcesRoot);
    expect(names.has("qbx_core")).toBe(true);
    expect(names.has("ox_inventory")).toBe(true);
  });
});

describe("detectFrameworkProfile", () => {
  it("detects qbox + ox_inventory stacks", async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "fdt-fw-ws-"));
    tempDirs.push(workspaceRoot);
    const resourcesRoot = await makeResourcesTree({
      "[qbx]": ["qbx_core"],
      "[ox]": ["ox_inventory", "ox_lib"],
    });

    const profile = await detectFrameworkProfile({
      workspaceRoot,
      workspace: {
        schemaVersion: 1,
        name: "Test",
        serverRoot: "server",
        resourcesRoot: path.relative(workspaceRoot, resourcesRoot).replace(/\\/g, "/"),
        serverCfg: "server/server.cfg",
        artifactOutput: "./.fdt/exports",
        frameworkTargets: ["custom"],
        rulesets: ["baseline"],
        resourceIgnore: [],
      },
    });

    expect(profile.framework).toBe("qbox");
    expect(profile.inventory).toBe("ox-inventory");
    expect(profile.recommendedAdapters).toEqual(
      expect.arrayContaining(["custom-json", "ox-inventory", "qbox"]),
    );
    expect(profile.source).toBe("detected");
  });

  it("respects manual workspace overrides", async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "fdt-fw-manual-"));
    tempDirs.push(workspaceRoot);
    const resourcesRoot = await makeResourcesTree({
      "[qbx]": ["qbx_core"],
      "[ox]": ["ox_inventory"],
    });

    const profile = await detectFrameworkProfile({
      workspaceRoot,
      workspace: {
        schemaVersion: 1,
        name: "Test",
        serverRoot: "server",
        resourcesRoot: path.relative(workspaceRoot, resourcesRoot).replace(/\\/g, "/"),
        serverCfg: "server/server.cfg",
        artifactOutput: "./.fdt/exports",
        frameworkTargets: ["custom"],
        rulesets: ["baseline"],
        resourceIgnore: [],
        frameworkProfile: {
          framework: "esx",
          inventory: "esx",
        },
      },
    });

    expect(profile.framework).toBe("esx");
    expect(profile.inventory).toBe("esx");
    expect(profile.source).toBe("manual");
    expect(profile.autoDetected.framework).toBe("qbox");
  });
});
