import type { MapAuditFinding, MapAuditReport, MapPackage, MapTestPointsExport } from "@fdt/schemas";
import { MapTestPointsExportSchema } from "@fdt/schemas";

export interface ScannedMapResource {
  resourceName: string;
  resourcePath: string;
  hasManifest: boolean;
  streamCounts: {
    ymap: number;
    ytyp: number;
    ybn: number;
    ydr: number;
    ytd: number;
    other: number;
  };
  streamFileCount: number;
  hasEntrancesFile: boolean;
  hasTestPointsFile: boolean;
  entrances: unknown[];
  testPoints: unknown[];
}

export interface ValidateMapsOptions {
  workspaceName: string;
  workspaceRoot: string;
  maps: MapPackage[];
  scanned: ScannedMapResource[];
}

function hasCoreMapAssets(streamCounts: ScannedMapResource["streamCounts"]): boolean {
  return streamCounts.ymap > 0 || streamCounts.ytyp > 0 || streamCounts.ybn > 0;
}

export function validateMaps(options: ValidateMapsOptions): MapAuditReport {
  const findings: MapAuditFinding[] = [];
  const scannedByResource = new Map(options.scanned.map((scan) => [scan.resourceName, scan]));

  for (const scan of options.scanned) {
    if (!scan.hasManifest) {
      findings.push({
        id: `missing-manifest:${scan.resourceName}`,
        severity: "error",
        code: "missing_manifest",
        message: `Resource ${scan.resourceName} has no fxmanifest.lua`,
        resourceName: scan.resourceName,
      });
    }

    if (scan.streamFileCount === 0) {
      findings.push({
        id: `empty-stream:${scan.resourceName}`,
        severity: "warning",
        code: "empty_stream_folder",
        message: `Resource ${scan.resourceName} has no files in stream/`,
        resourceName: scan.resourceName,
      });
    } else if (!hasCoreMapAssets(scan.streamCounts)) {
      findings.push({
        id: `missing-core-assets:${scan.resourceName}`,
        severity: "warning",
        code: "missing_core_map_assets",
        message: `Resource ${scan.resourceName} stream/ has no .ymap, .ytyp, or .ybn assets`,
        resourceName: scan.resourceName,
        details: { streamCounts: scan.streamCounts },
      });
    }

    if (scan.streamCounts.other > 0) {
      findings.push({
        id: `unsupported-stream:${scan.resourceName}`,
        severity: "info",
        code: "unsupported_stream_types",
        message: `Resource ${scan.resourceName} has ${scan.streamCounts.other} unsupported stream file(s)`,
        resourceName: scan.resourceName,
      });
    }

    if (!scan.hasEntrancesFile && scan.entrances.length === 0) {
      findings.push({
        id: `missing-entrances:${scan.resourceName}`,
        severity: "warning",
        code: "entrances_not_documented",
        message: `Resource ${scan.resourceName} has no entrance coordinates documented`,
        resourceName: scan.resourceName,
      });
    }

    if (!scan.hasTestPointsFile && scan.testPoints.length === 0) {
      findings.push({
        id: `missing-test-points:${scan.resourceName}`,
        severity: "info",
        code: "test_points_missing",
        message: `Resource ${scan.resourceName} has no QA test points defined`,
        resourceName: scan.resourceName,
      });
    }
  }

  for (const mapPackage of options.maps) {
    const scan = scannedByResource.get(mapPackage.resourceName);
    if (!scan && mapPackage.resourceName) {
      findings.push({
        id: `registry-missing-resource:${mapPackage.id}`,
        severity: "warning",
        code: "registry_resource_missing",
        message: `Map ${mapPackage.id} references missing resource ${mapPackage.resourceName}`,
        mapId: mapPackage.id,
        resourceName: mapPackage.resourceName,
      });
    }
  }

  const errors = findings.filter((finding) => finding.severity === "error").length;
  const warnings = findings.filter((finding) => finding.severity === "warning").length;
  const info = findings.filter((finding) => finding.severity === "info").length;

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    workspaceName: options.workspaceName,
    workspaceRoot: options.workspaceRoot,
    summary: {
      mapsChecked: options.maps.length,
      resourcesScanned: options.scanned.length,
      errors,
      warnings,
      info,
    },
    findings,
  };
}

export function renderMapTestPoints(mapPackage: MapPackage): MapTestPointsExport {
  const metadataPoints = Array.isArray(mapPackage.metadata.testPoints)
    ? (mapPackage.metadata.testPoints as Array<Record<string, unknown>>)
    : [];

  const entrancePoints = mapPackage.entrances.map((coords, index) => ({
    id: `entrance_${index + 1}`,
    label: `${mapPackage.label} entrance ${index + 1}`,
    type: "entrance" as const,
    coords,
    mapId: mapPackage.id,
    resourceName: mapPackage.resourceName,
  }));

  const customPoints = metadataPoints.map((point, index) => ({
    id: String(point.id ?? `test_${index + 1}`),
    label: String(point.label ?? `Test point ${index + 1}`),
    type: (point.type as MapTestPointsExport["testPoints"][number]["type"]) ?? "custom",
    coords: point.coords as MapTestPointsExport["testPoints"][number]["coords"],
    mapId: mapPackage.id,
    resourceName: mapPackage.resourceName,
  }));

  return MapTestPointsExportSchema.parse({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mapId: mapPackage.id,
    resourceName: mapPackage.resourceName,
    testPoints: [...entrancePoints, ...customPoints],
  });
}

export function renderWorkspaceMapTestPoints(
  workspaceName: string,
  maps: MapPackage[],
): { schemaVersion: 1; generatedAt: string; workspaceName: string; maps: MapTestPointsExport[] } {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    workspaceName,
    maps: maps.map((mapPackage) => renderMapTestPoints(mapPackage)),
  };
}
