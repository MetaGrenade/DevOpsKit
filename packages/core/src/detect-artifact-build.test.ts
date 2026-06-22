import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { detectServerArtifactBuild } from "./detect-artifact-build.js";
import type { Workspace } from "@fdt/schemas";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    tempDirs.pop();
  }
});

function createTempWorkspace(structure: Record<string, string>): {
  root: string;
  workspace: Workspace;
} {
  const root = mkdtempSync(path.join(os.tmpdir(), "fdt-artifact-"));
  tempDirs.push(root);

  for (const [relativePath, contents] of Object.entries(structure)) {
    const absolutePath = path.join(root, relativePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, contents, "utf8");
  }

  writeFileSync(
    path.join(root, "fdt.workspace.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        name: "Artifact Test",
        serverRoot: "./server",
        resourcesRoot: "./server/resources",
        serverCfg: "./server/server.cfg",
      },
      null,
      2,
    ),
    "utf8",
  );

  return {
    root,
    workspace: {
      schemaVersion: 1,
      name: "Artifact Test",
      serverRoot: "./server",
      resourcesRoot: "./server/resources",
      serverCfg: "./server/server.cfg",
      artifactOutput: "./.fdt/exports",
      frameworkTargets: ["custom"],
      rulesets: ["baseline"],
      resourceIgnore: [],
    },
  };
}

describe("detectServerArtifactBuild", () => {
  it("prefers an explicit workspace override", () => {
    const { root, workspace } = createTempWorkspace({
      "server/server.cfg": "# test",
    });

    const detected = detectServerArtifactBuild(root, {
      ...workspace,
      serverArtifactBuild: 12345,
    });

    expect(detected).toEqual({
      build: 12345,
      source: "workspace.config",
      path: "fdt.workspace.json",
    });
  });

  it("reads txAdmin .fxserver-artifact-version from serverRoot", () => {
    const { root, workspace } = createTempWorkspace({
      "server/.fxserver-artifact-version": "29753\n",
      "server/server.cfg": "# test",
    });

    expect(detectServerArtifactBuild(root, workspace)).toEqual({
      build: 29753,
      source: "fxserver-artifact-version",
      path: "server/.fxserver-artifact-version",
    });
  });

  it("reads citizen/version.json when artifact marker is absent", () => {
    const { root, workspace } = createTempWorkspace({
      "server/citizen/version.json": JSON.stringify({ version: 28001 }),
      "server/server.cfg": "# test",
    });

    expect(detectServerArtifactBuild(root, workspace)).toEqual({
      build: 28001,
      source: "citizen-version-json",
      path: "server/citizen/version.json",
    });
  });
});
