import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceSchema } from "@fdt/schemas";
import { buildWorkspaceManifest, detectReleaseChanges } from "./detect-release-changes.js";
import { createRelease, updateReleaseStatus } from "./release-store.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeWorkspace(): Promise<{ root: string; workspace: ReturnType<typeof WorkspaceSchema.parse> }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fdt-release-"));
  tempDirs.push(root);

  const resourcesRoot = path.join(root, "server", "resources", "[meta]", "demo_resource");
  await mkdir(resourcesRoot, { recursive: true });
  await writeFile(path.join(resourcesRoot, "fxmanifest.lua"), "fx_version 'cerulean'\n", "utf8");
  await writeFile(path.join(resourcesRoot, "client.lua"), "print('demo')\n", "utf8");

  await mkdir(path.join(root, ".fdt", "reports"), { recursive: true });
  await writeFile(
    path.join(root, ".fdt", "reports", "resource-doctor.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        workspaceName: "Release Test",
        workspaceRoot: root,
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

  const workspace = WorkspaceSchema.parse({
    schemaVersion: 1,
    name: "Release Test",
    serverRoot: "./server",
    resourcesRoot: "./server/resources",
    serverCfg: "./server/server.cfg",
    artifactOutput: "./.fdt/exports",
  });

  await writeFile(path.join(root, "fdt.workspace.json"), `${JSON.stringify(workspace, null, 2)}\n`, "utf8");

  return { root, workspace };
}

describe("detect-release-changes", () => {
  it("detects changed resource files via manifest hash", async () => {
    const { root, workspace } = await makeWorkspace();
    const baseline = await buildWorkspaceManifest(root, workspace);

    await writeFile(
      path.join(root, "server", "resources", "[meta]", "demo_resource", "client.lua"),
      "print('updated')\n",
      "utf8",
    );

    const changes = await detectReleaseChanges({
      workspaceRoot: root,
      workspace,
      previousManifest: baseline,
    });

    expect(changes.detectionMethod).toBe("manifest-hash");
    expect(changes.changedResources).toContain("demo_resource");
  });
});

describe("release-store", () => {
  it("creates a release bundle and updates status", async () => {
    const { root, workspace } = await makeWorkspace();

    const release = await createRelease({
      workspaceRoot: root,
      workspace,
      input: { version: "0.1.0", targetEnvironment: "dev" },
    });

    expect(release.version).toBe("0.1.0");
    expect(release.status).toBe("validated");
    expect(release.bundlePath).toBe(".fdt/releases/0.1.0");

    const bundleRelease = JSON.parse(
      await readFile(path.join(root, ".fdt", "releases", "0.1.0", "release.json"), "utf8"),
    ) as { version: string };
    expect(bundleRelease.version).toBe("0.1.0");

    const updated = await updateReleaseStatus(root, release.id, {
      status: "qa-ready",
      note: "Ready for QA",
    });

    expect(updated.status).toBe("qa-ready");
    expect(updated.statusHistory.some((entry) => entry.status === "qa-ready")).toBe(true);
  });

  it("blocks release creation when validation has errors", async () => {
    const { root, workspace } = await makeWorkspace();

    await writeFile(
      path.join(root, ".fdt", "reports", "resource-doctor.json"),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          generatedAt: new Date().toISOString(),
          workspaceName: "Release Test",
          workspaceRoot: root,
          summary: {
            resourcesScanned: 1,
            errors: 2,
            warnings: 0,
            info: 0,
            passed: 0,
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

    await expect(
      createRelease({
        workspaceRoot: root,
        workspace,
        input: { version: "0.2.0" },
      }),
    ).rejects.toThrow(/error/i);
  });
});
