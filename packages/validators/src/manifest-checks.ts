import { existsSync } from "node:fs";
import path from "node:path";
import type { ResolvedArtifactBuild } from "@fdt/core";
import type { Finding, Resource, Workspace } from "@fdt/schemas";
import {
  collectManifestPackagedPaths,
  collectManifestReferencedPaths,
  isExternalResourceReference,
  isGlobPattern,
  isRemoteUrl,
} from "@fdt/scanner";
import {
  ARTIFACT_LUA54_DEPRECATED,
  ARTIFACT_MANIFEST_VERSION_REQUIRED,
  artifactMeetsRequirement,
  artifactPolicyApplies,
} from "./artifact-policy.js";

export interface ManifestCheckContext {
  workspaceRoot: string;
  workspace: Workspace;
  artifactBuild?: ResolvedArtifactBuild;
  createFinding: (partial: Omit<Finding, "id"> & { id?: string }) => Finding;
}

function resolveManifestPath(resource: Resource, relativePath: string): string {
  return `${resource.path}/${relativePath}`.replace(/\\/g, "/");
}

function fileExistsOnDisk(workspaceRoot: string, relativePath: string): boolean {
  return existsSync(path.resolve(workspaceRoot, relativePath));
}

function countManifestKeyOccurrences(raw: string | undefined, key: string): number {
  if (!raw) {
    return 0;
  }

  const pattern = new RegExp(`^\\s*${key}\\s+`, "gim");
  return raw.match(pattern)?.length ?? 0;
}

function isSemverLike(value: string): boolean {
  return /^\d+(?:\.\d+){0,3}(?:[-+][\w.-]+)?$/i.test(value.trim());
}

function hasAnyScripts(resource: Resource): boolean {
  const manifest = resource.manifest;
  if (manifest.type === "missing") {
    return false;
  }

  return (
    manifest.clientScripts.length +
      manifest.serverScripts.length +
      manifest.sharedScripts.length >
    0
  );
}

function isStreamOrMapResource(resource: Resource): boolean {
  const manifest = resource.manifest;
  if (manifest.type === "missing") {
    return resource.streamAssets.length > 0;
  }

  return Boolean(manifest.serverOnly || manifest.isMap || resource.streamAssets.length > 0);
}

export function validateManifestPresence(
  resource: Resource,
  ctx: ManifestCheckContext,
): Finding[] {
  if (resource.manifest.type === "missing") {
    return [
      ctx.createFinding({
        severity: "error",
        code: "manifest.missing",
        message: `Resource "${resource.name}" has no fxmanifest.lua or __resource.lua`,
        resource: resource.name,
        file: resource.path,
      }),
    ];
  }

  if (resource.manifest.type === "legacy_resource") {
    return [
      ctx.createFinding({
        severity: "warning",
        code: "manifest.legacy",
        message: `Resource "${resource.name}" uses legacy __resource.lua`,
        resource: resource.name,
        file: `${resource.path}/__resource.lua`,
      }),
    ];
  }

  return [];
}

export function validateFxVersion(resource: Resource, ctx: ManifestCheckContext): Finding[] {
  if (resource.manifest.type !== "fxmanifest") {
    return [];
  }

  const findings: Finding[] = [];

  if (resource.manifest.resourceManifestVersion) {
    findings.push(
      ctx.createFinding({
        severity: "warning",
        code: "manifest.deprecated_manifest_version",
        message: `Resource "${resource.name}" uses deprecated resource_manifest_version; migrate to fx_version 'cerulean'`,
        resource: resource.name,
        manifestKey: "resource_manifest_version",
        details: { value: resource.manifest.resourceManifestVersion },
      }),
    );
  }

  if (!resource.manifest.fxVersion) {
    findings.push(
      ctx.createFinding({
        severity: "warning",
        code: "manifest.missing_fx_version",
        message: `Resource "${resource.name}" is missing fx_version`,
        resource: resource.name,
        manifestKey: "fx_version",
      }),
    );
  } else if (resource.manifest.fxVersion.toLowerCase() !== "cerulean") {
    findings.push(
      ctx.createFinding({
        severity: "warning",
        code: "manifest.deprecated_fx_version",
        message: `Resource "${resource.name}" uses fx_version '${resource.manifest.fxVersion}'; cerulean is recommended for current server artifacts`,
        resource: resource.name,
        manifestKey: "fx_version",
        details: { fxVersion: resource.manifest.fxVersion },
      }),
    );
  }

  return findings;
}

export function validateManifestMetadata(resource: Resource, ctx: ManifestCheckContext): Finding[] {
  if (resource.manifest.type !== "fxmanifest") {
    return [];
  }

  const findings: Finding[] = [];
  const { manifest } = resource;
  const versionRequired = artifactPolicyApplies(
    ctx.artifactBuild,
    ARTIFACT_MANIFEST_VERSION_REQUIRED,
  );
  const lua54Deprecated = artifactPolicyApplies(ctx.artifactBuild, ARTIFACT_LUA54_DEPRECATED);

  if (versionRequired && !manifest.version) {
    findings.push(
      ctx.createFinding({
        severity: "warning",
        code: "manifest.missing_version",
        message: `Resource "${resource.name}" is missing version metadata in fxmanifest.lua`,
        resource: resource.name,
        manifestKey: "version",
        details: {
          minimumArtifactBuild: ARTIFACT_MANIFEST_VERSION_REQUIRED,
          detectedArtifactBuild: ctx.artifactBuild?.build,
        },
      }),
    );
  } else if (manifest.version && !isSemverLike(manifest.version)) {
    findings.push(
      ctx.createFinding({
        severity: "info",
        code: "manifest.non_semver_version",
        message: `Resource "${resource.name}" version '${manifest.version}' is not semver-like`,
        resource: resource.name,
        manifestKey: "version",
        details: { version: manifest.version },
      }),
    );
  }

  if (countManifestKeyOccurrences(manifest.raw, "version") > 1) {
    findings.push(
      ctx.createFinding({
        severity: "warning",
        code: "manifest.duplicate_metadata",
        message: `Resource "${resource.name}" declares version more than once in fxmanifest.lua`,
        resource: resource.name,
        manifestKey: "version",
      }),
    );
  }

  if (lua54Deprecated && manifest.lua54) {
    findings.push(
      ctx.createFinding({
        severity: "info",
        code: "manifest.deprecated_lua54",
        message: `Resource "${resource.name}" declares lua54; Lua 5.4 is default on server artifact ${ctx.artifactBuild!.build} and this directive is deprecated`,
        resource: resource.name,
        manifestKey: "lua54",
        details: {
          minimumArtifactBuild: ARTIFACT_LUA54_DEPRECATED,
          detectedArtifactBuild: ctx.artifactBuild?.build,
        },
      }),
    );
  }

  return findings;
}

export function validateGameDeclaration(resource: Resource, ctx: ManifestCheckContext): Finding[] {
  if (resource.manifest.type !== "fxmanifest") {
    return [];
  }

  const hasGta5 = resource.manifest.games.some(
    (game) => game.toLowerCase() === "gta5" || game.toLowerCase() === "common",
  );

  if (!hasGta5) {
    return [
      ctx.createFinding({
        severity: "warning",
        code: "manifest.missing_game",
        message: `Resource "${resource.name}" does not declare game 'gta5'`,
        resource: resource.name,
        manifestKey: "game",
      }),
    ];
  }

  return [];
}

export function validateScriptPresence(resource: Resource, ctx: ManifestCheckContext): Finding[] {
  if (resource.manifest.type !== "fxmanifest") {
    return [];
  }

  if (isStreamOrMapResource(resource) || hasAnyScripts(resource)) {
    return [];
  }

  return [
    ctx.createFinding({
      severity: "info",
      code: "manifest.no_scripts",
      message: `Resource "${resource.name}" declares no client, server, or shared scripts`,
      resource: resource.name,
    }),
  ];
}

export function validatePackagedFiles(resource: Resource, ctx: ManifestCheckContext): Finding[] {
  if (resource.manifest.type !== "fxmanifest") {
    return [];
  }

  const findings: Finding[] = [];
  const { manifest } = resource;
  const packagedPaths = new Set(collectManifestPackagedPaths(manifest));

  if (manifest.uiPage && !isRemoteUrl(manifest.uiPage) && !packagedPaths.has(manifest.uiPage)) {
    findings.push(
      ctx.createFinding({
        severity: "warning",
        code: "manifest.missing_ui_page_file",
        message: `Resource "${resource.name}" ui_page '${manifest.uiPage}' is not listed in files/file entries`,
        resource: resource.name,
        manifestKey: "ui_page",
        details: { uiPage: manifest.uiPage },
      }),
    );
  }

  if (manifest.loadscreen && !packagedPaths.has(manifest.loadscreen)) {
    findings.push(
      ctx.createFinding({
        severity: "warning",
        code: "manifest.missing_loadscreen_file",
        message: `Resource "${resource.name}" loadscreen '${manifest.loadscreen}' is not listed in files/file entries`,
        resource: resource.name,
        manifestKey: "loadscreen",
        details: { loadscreen: manifest.loadscreen },
      }),
    );
  }

  return findings;
}

export function validateReferencedPaths(
  resource: Resource,
  ctx: ManifestCheckContext,
): Finding[] {
  if (resource.manifest.type === "missing") {
    return [];
  }

  const findings: Finding[] = [];

  for (const referenced of collectManifestReferencedPaths(resource.manifest)) {
    if (isExternalResourceReference(referenced) || isRemoteUrl(referenced) || isGlobPattern(referenced)) {
      continue;
    }

    if (referenced.includes("\\")) {
      findings.push(
        ctx.createFinding({
          severity: "warning",
          code: "manifest.windows_path_separator",
          message: `Resource "${resource.name}" manifest path '${referenced}' uses Windows backslashes; use forward slashes for Linux server compatibility`,
          resource: resource.name,
          file: resolveManifestPath(resource, referenced),
          details: { referencedPath: referenced },
        }),
      );
    }

    const normalized = resolveManifestPath(resource, referenced);
    if (!fileExistsOnDisk(ctx.workspaceRoot, normalized)) {
      findings.push(
        ctx.createFinding({
          severity: "error",
          code: "manifest.missing_file",
          message: `Manifest references missing file "${referenced}" in resource "${resource.name}"`,
          resource: resource.name,
          file: normalized,
          manifestKey: "files",
          details: { referencedPath: referenced },
        }),
      );
    }
  }

  return findings;
}

export function validateRuntimeDependencies(
  resource: Resource,
  ctx: ManifestCheckContext,
): Finding[] {
  if (resource.manifest.type !== "fxmanifest") {
    return [];
  }

  const findings: Finding[] = [];
  const detectedBuild = ctx.artifactBuild?.build ?? ctx.workspace.serverArtifactBuild;

  for (const runtimeDependency of resource.manifest.runtimeDependencies) {
    if (runtimeDependency.startsWith("/server:")) {
      const requiredBuild = Number(runtimeDependency.slice("/server:".length));
      if (!Number.isFinite(requiredBuild)) {
        continue;
      }

      const meetsRequirement = artifactMeetsRequirement(ctx.artifactBuild, requiredBuild);
      if (meetsRequirement === false || (detectedBuild && requiredBuild > detectedBuild)) {
        findings.push(
          ctx.createFinding({
            severity: "error",
            code: "manifest.unsatisfied_server_build",
            message: `Resource "${resource.name}" requires server artifact build ${requiredBuild}, but detected build is ${detectedBuild ?? "unknown"}`,
            resource: resource.name,
            manifestKey: "dependencies",
            details: {
              requiredBuild,
              detectedBuild,
              artifactSource: ctx.artifactBuild?.source,
            },
          }),
        );
        continue;
      }

      if (meetsRequirement === undefined) {
        findings.push(
          ctx.createFinding({
            severity: "info",
            code: "manifest.runtime_server_build",
            message: `Resource "${resource.name}" requires server artifact build ${requiredBuild} or newer`,
            resource: resource.name,
            manifestKey: "dependencies",
            details: { requiredBuild },
          }),
        );
      }

      continue;
    }

    if (runtimeDependency === "/onesync") {
      findings.push(
        ctx.createFinding({
          severity: "info",
          code: "manifest.runtime_onesync",
          message: `Resource "${resource.name}" requires OneSync/state awareness to be enabled`,
          resource: resource.name,
          manifestKey: "dependencies",
        }),
      );
      continue;
    }

    if (runtimeDependency.startsWith("/gameBuild:")) {
      findings.push(
        ctx.createFinding({
          severity: "info",
          code: "manifest.runtime_game_build",
          message: `Resource "${resource.name}" requires game build '${runtimeDependency.slice("/gameBuild:".length)}' or newer`,
          resource: resource.name,
          manifestKey: "dependencies",
          details: { gameBuild: runtimeDependency.slice("/gameBuild:".length) },
        }),
      );
    }
  }

  return findings;
}

export function validateManifestChecks(
  resource: Resource,
  ctx: ManifestCheckContext,
): Finding[] {
  return [
    ...validateManifestPresence(resource, ctx),
    ...validateFxVersion(resource, ctx),
    ...validateManifestMetadata(resource, ctx),
    ...validateGameDeclaration(resource, ctx),
    ...validateScriptPresence(resource, ctx),
    ...validatePackagedFiles(resource, ctx),
    ...validateReferencedPaths(resource, ctx),
    ...validateRuntimeDependencies(resource, ctx),
  ];
}
