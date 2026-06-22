import { describe, expect, it } from "vitest";
import type { Resource } from "@fdt/schemas";
import {
  validateManifestMetadata,
  validatePackagedFiles,
  validateReferencedPaths,
  validateRuntimeDependencies,
} from "./manifest-checks.js";

function createFinding(partial: {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  resource?: string;
  manifestKey?: string;
}) {
  return {
    id: "finding-test",
    ...partial,
  };
}

function makeResource(manifest: Resource["manifest"], overrides: Partial<Resource> = {}): Resource {
  return {
    name: "sample_resource",
    path: "server/resources/[standalone]/sample_resource",
    manifest,
    exports: [],
    events: [],
    streamAssets: [],
    warnings: [],
    errors: [],
    ...overrides,
  };
}

describe("manifest checks", () => {
  const artifactBuild = {
    build: 29_753,
    source: "fxserver-artifact-version" as const,
    path: "server/.fxserver-artifact-version",
  };

  const ctx = {
    workspaceRoot: "/workspace",
    workspace: {
      schemaVersion: 1 as const,
      name: "Test",
      serverRoot: "./server",
      resourcesRoot: "./server/resources",
      serverCfg: "./server/server.cfg",
      artifactOutput: "./.fdt/exports",
      frameworkTargets: ["custom" as const],
      rulesets: ["baseline"],
      resourceIgnore: [],
    },
    artifactBuild,
    createFinding,
  };

  it("warns when version metadata is missing on modern artifacts", () => {
    const resource = makeResource({
      type: "fxmanifest",
      fxVersion: "cerulean",
      games: ["gta5"],
      clientScripts: [],
      serverScripts: [],
      sharedScripts: [],
      files: [],
      fileEntries: [],
      dependencies: [],
      runtimeDependencies: [],
      provides: [],
      escrowIgnore: [],
    });

    const findings = validateManifestMetadata(resource, ctx);
    expect(findings.some((finding) => finding.code === "manifest.missing_version")).toBe(true);
  });

  it("warns when ui_page is not packaged in files", () => {
    const resource = makeResource({
      type: "fxmanifest",
      fxVersion: "cerulean",
      games: ["gta5"],
      version: "1.0.0",
      uiPage: "html/index.html",
      clientScripts: [],
      serverScripts: [],
      sharedScripts: [],
      files: [],
      fileEntries: [],
      dependencies: [],
      runtimeDependencies: [],
      provides: [],
      escrowIgnore: [],
    });

    const findings = validatePackagedFiles(resource, ctx);
    expect(findings.some((finding) => finding.code === "manifest.missing_ui_page_file")).toBe(true);
  });

  it("skips glob and external references during file existence checks", () => {
    const resource = makeResource({
      type: "fxmanifest",
      fxVersion: "cerulean",
      games: ["gta5"],
      version: "1.0.0",
      clientScripts: ["@ox_lib/init.lua", "client/*.lua"],
      serverScripts: [],
      sharedScripts: [],
      files: [],
      fileEntries: [],
      dependencies: [],
      runtimeDependencies: [],
      provides: [],
      escrowIgnore: [],
    });

    const findings = validateReferencedPaths(resource, ctx);
    expect(findings).toEqual([]);
  });

  it("flags unsatisfied server artifact runtime dependencies", () => {
    const resource = makeResource({
      type: "fxmanifest",
      fxVersion: "cerulean",
      games: ["gta5"],
      version: "1.0.0",
      clientScripts: [],
      serverScripts: [],
      sharedScripts: [],
      files: [],
      fileEntries: [],
      dependencies: [],
      runtimeDependencies: ["/server:9000"],
      provides: [],
      escrowIgnore: [],
    });

    const findings = validateRuntimeDependencies(resource, {
      ...ctx,
      artifactBuild: {
        build: 8000,
        source: "fxserver-artifact-version",
        path: "server/.fxserver-artifact-version",
      },
    });

    expect(findings.some((finding) => finding.code === "manifest.unsatisfied_server_build")).toBe(
      true,
    );
  });
});
