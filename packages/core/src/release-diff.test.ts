import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceSchema } from "@fdt/schemas";
import { createRelease } from "./release-store.js";
import {
  buildReleaseChecklist,
  buildReleaseDiffReport,
  compareReleases,
  exportReleaseBundle,
  renderReleaseDiffMarkdown,
} from "./release-diff.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeWorkspace() {
  const root = await mkdtemp(path.join(os.tmpdir(), "fdt-release-diff-"));
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
        workspaceName: "Release Diff Test",
        workspaceRoot: root,
        summary: { resourcesScanned: 1, errors: 0, warnings: 0, info: 0, passed: 1 },
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
    name: "Release Diff Test",
    serverRoot: "./server",
    resourcesRoot: "./server/resources",
    serverCfg: "./server/server.cfg",
    artifactOutput: "./.fdt/exports",
  });

  return { root, workspace };
}

describe("release diff", () => {
  it("compares changed sections between two releases", async () => {
    const { root, workspace } = await makeWorkspace();

    const first = await createRelease({
      workspaceRoot: root,
      workspace,
      input: { version: "0.1.0" },
    });

    const secondResourceRoot = path.join(root, "server", "resources", "[meta]", "second_resource");
    await mkdir(secondResourceRoot, { recursive: true });
    await writeFile(path.join(secondResourceRoot, "fxmanifest.lua"), "fx_version 'cerulean'\n", "utf8");

    const second = await createRelease({
      workspaceRoot: root,
      workspace,
      input: { version: "0.2.0" },
    });

    expect(first.changedResources).not.toEqual(second.changedResources);

    const report = await buildReleaseDiffReport(root, "0.1.0", "0.2.0");
    expect(report.fromVersion).toBe("0.1.0");
    expect(report.toVersion).toBe("0.2.0");
    expect(renderReleaseDiffMarkdown(report)).toContain("0.1.0 → 0.2.0");
    expect(report.sections.resources.added).toContain("second_resource");

    const direct = compareReleases(first, second);
    expect(direct.sections.resources.added).toContain("second_resource");
  });

  it("builds a release checklist and exports the bundle", async () => {
    const { root, workspace } = await makeWorkspace();

    const release = await createRelease({
      workspaceRoot: root,
      workspace,
      input: { version: "0.3.0" },
    });

    const checklist = await buildReleaseChecklist(root, release.version);
    expect(checklist.releaseVersion).toBe("0.3.0");
    expect(checklist.items.some((item) => item.id === "bundle-present" && item.status === "passed")).toBe(true);

    const exported = await exportReleaseBundle({
      workspaceRoot: root,
      releaseVersion: release.version,
      outputDir: ".fdt/exports/releases/0.3.0",
    });

    const releaseJson = await readFile(path.join(exported.outputDir, "release.json"), "utf8");
    expect(JSON.parse(releaseJson).version).toBe("0.3.0");
  });
});
