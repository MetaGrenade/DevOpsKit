import type { Vehicle, VehicleAuditFinding, VehicleAuditReport, VehicleFiles, VehicleSpawnTestList } from "@fdt/schemas";

export interface ScannedVehicleResource {
  resourceName: string;
  spawnNames: string[];
  files: VehicleFiles;
}

export interface ValidateVehiclesOptions {
  workspaceName: string;
  workspaceRoot: string;
  vehicles: Vehicle[];
  scanned: ScannedVehicleResource[];
}

function hasStreamModel(files: Vehicle["files"], spawnName: string): boolean {
  if (!files?.yft?.length) {
    return false;
  }
  const target = `${spawnName}.yft`.toLowerCase();
  return files.yft.some((file) => file.toLowerCase() === target);
}

export function validateVehicles(options: ValidateVehiclesOptions): VehicleAuditReport {
  const findings: VehicleAuditFinding[] = [];
  const spawnOwners = new Map<string, { spawnName: string; resourceName: string }>();

  for (const scan of options.scanned) {
    if (!scan.files.vehiclesMeta) {
      findings.push({
        id: `missing-vehicles-meta:${scan.resourceName}`,
        severity: "warning",
        code: "missing_vehicles_meta",
        message: `Resource ${scan.resourceName} has no vehicles.meta file`,
        resourceName: scan.resourceName,
      });
    }

    if (!scan.files.handlingMeta) {
      findings.push({
        id: `missing-handling-meta:${scan.resourceName}`,
        severity: "warning",
        code: "missing_handling_meta",
        message: `Resource ${scan.resourceName} has no handling.meta file`,
        resourceName: scan.resourceName,
      });
    }

    if (scan.files.yft.length === 0) {
      findings.push({
        id: `empty-stream:${scan.resourceName}`,
        severity: "warning",
        code: "empty_stream_folder",
        message: `Resource ${scan.resourceName} has no .yft models in stream/`,
        resourceName: scan.resourceName,
      });
    }

    for (const spawnName of scan.spawnNames) {
      const existing = spawnOwners.get(spawnName);
      if (existing && existing.resourceName !== scan.resourceName) {
        findings.push({
          id: `duplicate-spawn:${spawnName}:${scan.resourceName}`,
          severity: "error",
          code: "duplicate_spawn_name",
          message: `Spawn name ${spawnName} is also declared in ${existing.resourceName}`,
          spawnName,
          resourceName: scan.resourceName,
          details: { otherResourceName: existing.resourceName },
        });
      } else {
        spawnOwners.set(spawnName, { spawnName, resourceName: scan.resourceName });
      }

      if (!hasStreamModel(scan.files, spawnName)) {
        findings.push({
          id: `missing-stream-model:${spawnName}`,
          severity: "warning",
          code: "missing_stream_model",
          message: `Spawn ${spawnName} has no matching ${spawnName}.yft in stream/`,
          spawnName,
          resourceName: scan.resourceName,
        });
      }
    }
  }

  const scannedSpawns = new Set(options.scanned.flatMap((scan) => scan.spawnNames));
  for (const vehicle of options.vehicles) {
    if (!scannedSpawns.has(vehicle.spawnName)) {
      findings.push({
        id: `registry-only:${vehicle.spawnName}`,
        severity: "info",
        code: "registry_only_vehicle",
        message: `Registry vehicle ${vehicle.spawnName} was not found in a scanned vehicle resource`,
        spawnName: vehicle.spawnName,
      });
    }
  }

  const summary = {
    vehiclesChecked: options.vehicles.length,
    resourcesScanned: options.scanned.length,
    errors: findings.filter((finding) => finding.severity === "error").length,
    warnings: findings.filter((finding) => finding.severity === "warning").length,
    info: findings.filter((finding) => finding.severity === "info").length,
  };

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    workspaceName: options.workspaceName,
    workspaceRoot: options.workspaceRoot,
    summary,
    findings: findings.sort((a, b) => {
      const rank = { error: 0, warning: 1, info: 2 } as const;
      return rank[a.severity] - rank[b.severity];
    }),
  };
}

export function renderVehicleSpawnTests(
  workspaceName: string,
  vehicles: Vehicle[],
): VehicleSpawnTestList {
  const tests = [...vehicles]
    .sort((a, b) => a.spawnName.localeCompare(b.spawnName))
    .map((vehicle) => ({
      spawnName: vehicle.spawnName,
      displayName: vehicle.displayName,
      category: vehicle.category,
      command: `/car ${vehicle.spawnName}`,
      resourceName:
        typeof vehicle.metadata.resourceName === "string" ? vehicle.metadata.resourceName : undefined,
    }));

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    workspaceName,
    tests,
  };
}
