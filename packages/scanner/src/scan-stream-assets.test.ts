import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildStreamAssetId, scanStreamAssets } from "./scan-stream-assets.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeWorkspace(structure: Record<string, Record<string, string>>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fdt-asset-scan-"));
  tempDirs.push(root);

  const resourcesRoot = path.join(root, "server", "resources");
  await mkdir(resourcesRoot, { recursive: true });
  await writeFile(path.join(root, "server", "server.cfg"), "ensure demo\n", "utf8");

  for (const [resourceName, files] of Object.entries(structure)) {
    const resourcePath = path.join(resourcesRoot, resourceName);
    await mkdir(resourcePath, { recursive: true });
    await writeFile(
      path.join(resourcePath, "fxmanifest.lua"),
      "fx_version 'cerulean'\ngame 'gta5'\n",
      "utf8",
    );

    for (const [relativePath, content] of Object.entries(files)) {
      const target = path.join(resourcePath, relativePath);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content, "utf8");
    }
  }

  return root;
}

describe("buildStreamAssetId", () => {
  it("is deterministic for the same resource/path", () => {
    const first = buildStreamAssetId("meta_clothing", "stream/shirt.ytd");
    const second = buildStreamAssetId("meta_clothing", "stream/shirt.ytd");
    expect(first).toBe(second);
    expect(first).toHaveLength(16);
  });
});

describe("scanStreamAssets", () => {
  it("indexes stream assets and preserves deterministic ordering", async () => {
    const workspaceRoot = await makeWorkspace({
      meta_clothing_a: {
        "stream/shirt.ytd": "texture-a",
        "stream/pants.ydr": "drawable-a",
      },
      meta_clothing_b: {
        "stream/shirt.ytd": "texture-b",
      },
    });

    const result = await scanStreamAssets({
      workspaceRoot,
      workspace: {
        schemaVersion: 1,
        name: "Test",
        serverRoot: "server",
        resourcesRoot: "server/resources",
        serverCfg: "server/server.cfg",
        artifactOutput: "./.fdt/exports",
        frameworkTargets: ["custom"],
        rulesets: ["baseline"],
        resourceIgnore: [],
      },
    });

    expect(result.assets).toHaveLength(3);
    expect(result.assets.map((asset) => asset.fileName)).toEqual(["pants.ydr", "shirt.ytd", "shirt.ytd"]);
    expect(result.resourceSummaries).toHaveLength(2);
  });
});
