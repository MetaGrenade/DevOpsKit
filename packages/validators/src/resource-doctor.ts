import { existsSync } from "node:fs";
import path from "node:path";
import type { Finding, ResourceDoctorReport, Workspace } from "@fdt/schemas";
import { detectServerArtifactBuild } from "@fdt/core";
import { allStartedResources, scanResources, type ScanResourcesResult } from "@fdt/scanner";
import { validateManifestChecks } from "./manifest-checks.js";

export interface ValidateResourcesOptions {
  workspaceRoot: string;
  workspace: Workspace;
  scanResult?: ScanResourcesResult;
}

let findingCounter = 0;

function nextFindingId(): string {
  findingCounter += 1;
  return `finding-${findingCounter}`;
}

function resetFindingCounter(): void {
  findingCounter = 0;
}

function createFinding(
  partial: Omit<Finding, "id"> & { id?: string },
): Finding {
  return {
    id: partial.id ?? nextFindingId(),
    severity: partial.severity,
    code: partial.code,
    message: partial.message,
    resource: partial.resource,
    file: partial.file,
    manifestKey: partial.manifestKey,
    details: partial.details,
  };
}

function fileExistsOnDisk(workspaceRoot: string, relativePath: string): boolean {
  return existsSync(path.resolve(workspaceRoot, relativePath));
}

function validateDuplicateNames(scanResult: ScanResourcesResult): Finding[] {
  const findings: Finding[] = [];

  for (const [name, resources] of scanResult.resourceNames.entries()) {
    if (resources.length <= 1) {
      continue;
    }

    findings.push(
      createFinding({
        severity: "error",
        code: "resource.duplicate_name",
        message: `Duplicate resource name "${name}" found in ${resources.length} locations`,
        resource: name,
        details: {
          paths: resources.map((resource) => resource.path),
        },
      }),
    );
  }

  return findings;
}

function validateServerCfg(
  workspaceRoot: string,
  scanResult: ScanResourcesResult,
): Finding[] {
  const findings: Finding[] = [];
  const knownNames = new Set(scanResult.resources.map((resource) => resource.name));
  const started = allStartedResources(scanResult.serverCfg);

  if (!fileExistsOnDisk(workspaceRoot, scanResult.serverCfg.path)) {
    findings.push(
      createFinding({
        severity: "error",
        code: "server_cfg.missing",
        message: `server.cfg not found at ${scanResult.serverCfg.path}`,
        file: scanResult.serverCfg.path,
      }),
    );
    return findings;
  }

  for (const missingExec of scanResult.serverCfg.missingExecs) {
    findings.push(
      createFinding({
        severity: "warning",
        code: "server_cfg.missing_exec",
        message: `Config file "${missingExec.target}" referenced via exec was not found`,
        file: missingExec.file,
        details: { line: missingExec.line, target: missingExec.target },
      }),
    );
  }

  for (const resourceName of started) {
    if (!knownNames.has(resourceName)) {
      findings.push(
        createFinding({
          severity: "error",
          code: "server_cfg.missing_resource",
          message: `Server configuration starts missing resource "${resourceName}"`,
          resource: resourceName,
          file: scanResult.serverCfg.path,
        }),
      );
    }
  }

  for (const resource of scanResult.resources) {
    if (resource.manifest.type === "missing") {
      continue;
    }

    if (scanResult.serverCfg.stopped.includes(resource.name)) {
      continue;
    }

    if (!started.includes(resource.name)) {
      findings.push(
        createFinding({
          severity: "warning",
          code: "server_cfg.unstarted_resource",
          message: `Resource "${resource.name}" exists but is not started in server configuration`,
          resource: resource.name,
          file: scanResult.serverCfg.path,
        }),
      );
    }
  }

  const seen = new Set<string>();
  for (const entry of scanResult.serverCfg.lines) {
    if (seen.has(entry.resource)) {
      findings.push(
        createFinding({
          severity: "warning",
          code: "server_cfg.duplicate_start",
          message: `Resource "${entry.resource}" is started more than once in server configuration`,
          resource: entry.resource,
          file: entry.file,
          details: { line: entry.line },
        }),
      );
    }
    seen.add(entry.resource);
  }

  return findings;
}

function validateMissingDependencies(scanResult: ScanResourcesResult): Finding[] {
  const knownNames = new Set(scanResult.resources.map((resource) => resource.name));
  const findings: Finding[] = [];

  for (const resource of scanResult.resources) {
    for (const dependency of resource.manifest.dependencies) {
      if (!knownNames.has(dependency)) {
        findings.push(
          createFinding({
            severity: "error",
            code: "manifest.missing_dependency",
            message: `Resource "${resource.name}" depends on missing resource "${dependency}"`,
            resource: resource.name,
            manifestKey: "dependency",
            details: { dependency },
          }),
        );
      }
    }
  }

  return findings;
}

export async function validateResources(
  options: ValidateResourcesOptions,
): Promise<ResourceDoctorReport> {
  resetFindingCounter();

  const scanResult =
    options.scanResult ??
    (await scanResources({
      workspaceRoot: options.workspaceRoot,
      workspace: options.workspace,
    }));

  const artifactBuild = detectServerArtifactBuild(options.workspaceRoot, options.workspace);

  const manifestContext = {
    workspaceRoot: options.workspaceRoot,
    workspace: options.workspace,
    artifactBuild,
    createFinding,
  };

  const findings: Finding[] = [];

  for (const resource of scanResult.resources) {
    findings.push(...validateManifestChecks(resource, manifestContext));
  }

  findings.push(
    ...validateDuplicateNames(scanResult),
    ...validateServerCfg(options.workspaceRoot, scanResult),
    ...validateMissingDependencies(scanResult),
  );

  const errors = findings.filter((finding) => finding.severity === "error").length;
  const warnings = findings.filter((finding) => finding.severity === "warning").length;
  const info = findings.filter((finding) => finding.severity === "info").length;

  const resourcesWithErrors = new Set(
    findings.filter((finding) => finding.severity === "error" && finding.resource).map((f) => f.resource!),
  );
  const passedResources = scanResult.resources.filter(
    (resource) => !resourcesWithErrors.has(resource.name),
  ).length;

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    workspaceName: options.workspace.name,
    workspaceRoot: options.workspaceRoot,
    summary: {
      resourcesScanned: scanResult.resources.length,
      errors,
      warnings,
      info,
      passed: passedResources,
    },
    resources: scanResult.resources,
    serverCfg: {
      path: scanResult.serverCfg.path,
      started: scanResult.serverCfg.started,
      ensured: scanResult.serverCfg.ensured,
    },
    serverArtifact: artifactBuild
      ? {
          build: artifactBuild.build,
          source: artifactBuild.source,
          path: artifactBuild.path,
        }
      : undefined,
    findings,
  };
}
