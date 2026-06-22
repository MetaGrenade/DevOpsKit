import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { auditStreamAssets, renderAssetAuditorMarkdown } from "./asset-auditor.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeWorkspace(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fdt-asset-audit-"));
  tempDirs.push(root);
  const resourcesRoot = path.join(root, "server", "resources");
  await mkdir(resourcesRoot, { recursive: true });
  await writeFile(path.join(root, "server", "server.cfg"), "ensure demo\n", "utf8");

  for (const resourceName of ["pack_a", "pack_b"]) {
    const resourcePath = path.join(resourcesRoot, resourceName);
    await mkdir(path.join(resourcePath, "stream"), { recursive: true });
    await writeFile(
      path.join(resourcePath, "fxmanifest.lua"),
      "fx_version 'cerulean'\ngame 'gta5'\n",
      "utf8",
    );
    await writeFile(path.join(resourcePath, "stream", "shared.ytd"), "duplicate-name", "utf8");
  }

  return root;
}

describe("auditStreamAssets", () => {
  it("flags duplicate stream filenames across resources", async () => {
    const workspaceRoot = await makeWorkspace();
    const report = await auditStreamAssets({
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

    expect(report.summary.duplicateFileNames).toBe(1);
    expect(report.findings.some((finding) => finding.code === "asset.duplicate_filename")).toBe(true);
    expect(renderAssetAuditorMarkdown(report)).toContain("Duplicate filenames");
  });
});
