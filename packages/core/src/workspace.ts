import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  WORKSPACE_CONFIG_FILENAMES,
  WorkspaceSchema,
  type Workspace,
} from "@fdt/schemas";

export type WorkspaceDiscoveryResult =
  | { status: "found"; configPath: string; workspace: Workspace }
  | { status: "not_found"; searchedPaths: string[] };

export interface WorkspaceLoaderOptions {
  workspaceRoot?: string;
  configPath?: string;
}

export function resolveWorkspaceConfigCandidates(
  workspaceRoot: string,
  configPath?: string,
): string[] {
  if (configPath) {
    return [path.resolve(workspaceRoot, configPath)];
  }

  return WORKSPACE_CONFIG_FILENAMES.map((filename) =>
    path.resolve(workspaceRoot, filename),
  );
}

export async function loadWorkspaceConfig(
  options: WorkspaceLoaderOptions = {},
): Promise<WorkspaceDiscoveryResult> {
  const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
  const candidates = resolveWorkspaceConfigCandidates(workspaceRoot, options.configPath);
  const existingPath = candidates.find((candidate) => existsSync(candidate));

  if (!existingPath) {
    return { status: "not_found", searchedPaths: candidates };
  }

  const raw = await readFile(existingPath, "utf8");
  const parsed = WorkspaceSchema.parse(JSON.parse(raw));

  return {
    status: "found",
    configPath: existingPath,
    workspace: parsed,
  };
}

export const FDT_OUTPUT_DIR = ".fdt";
export const FDT_REPORTS_DIR = `${FDT_OUTPUT_DIR}/reports`;
export const FDT_EXPORTS_DIR = `${FDT_OUTPUT_DIR}/exports`;
export const FDT_CONTENT_DIR = `${FDT_OUTPUT_DIR}/content`;
export const FDT_ITEMS_FILE = `${FDT_CONTENT_DIR}/items.json`;
export const FDT_VEHICLES_FILE = `${FDT_CONTENT_DIR}/vehicles.json`;
export const FDT_BUSINESSES_FILE = `${FDT_CONTENT_DIR}/businesses.json`;
export const FDT_MAPS_FILE = `${FDT_CONTENT_DIR}/maps.json`;
export const FDT_JOBS_FILE = `${FDT_CONTENT_DIR}/jobs.json`;
export const FDT_GANGS_FILE = `${FDT_CONTENT_DIR}/gangs.json`;
export const FDT_CLOTHING_PACKS_FILE = `${FDT_CONTENT_DIR}/clothing-packs.json`;
export const FDT_SHOPS_FILE = `${FDT_CONTENT_DIR}/shops.json`;
export const FDT_CRAFTING_FILE = `${FDT_CONTENT_DIR}/crafting-recipes.json`;
export const FDT_CLOTHING_CONFLICTS_REPORT = `${FDT_REPORTS_DIR}/clothing-conflicts.json`;
export const FDT_CLOTHING_CHANGELOG = `${FDT_REPORTS_DIR}/clothing-changelog.md`;
export const FDT_VEHICLE_AUDIT_REPORT = `${FDT_REPORTS_DIR}/vehicle-audit.json`;
export const FDT_MAP_AUDIT_REPORT = `${FDT_REPORTS_DIR}/map-audit.json`;
export const FDT_DEPENDENCY_GRAPH = `${FDT_REPORTS_DIR}/dependency-graph.json`;
export const FDT_NUI_SCHEMA_REPORT = `${FDT_REPORTS_DIR}/nui-schema-sync.json`;
export const FDT_ECONOMY_PROFILE_FILE = `${FDT_CONTENT_DIR}/economy-profile.json`;
export const FDT_ECONOMY_SIMULATION_REPORT = `${FDT_REPORTS_DIR}/economy-simulation.json`;
export const FDT_ECONOMY_MARKDOWN = `${FDT_REPORTS_DIR}/economy-simulation.md`;
export const FDT_STATE_BAG_DIR = `${FDT_OUTPUT_DIR}/state-bag`;
export const FDT_STATE_BAG_SNAPSHOTS_FILE = `${FDT_STATE_BAG_DIR}/snapshots.json`;
export const FDT_ZONES_DIR = `${FDT_OUTPUT_DIR}/zones`;
export const FDT_ZONES_FILE = `${FDT_ZONES_DIR}/zones.json`;
export const FDT_WORLD_DIR = `${FDT_OUTPUT_DIR}/world`;
export const FDT_BLIPS_FILE = `${FDT_WORLD_DIR}/blips.json`;
export const FDT_PROPS_FILE = `${FDT_WORLD_DIR}/props.json`;
export const FDT_DOORS_FILE = `${FDT_WORLD_DIR}/doors.json`;
export const FDT_ASSET_SCAN_REPORT = `${FDT_REPORTS_DIR}/asset-scan.json`;
export const FDT_ASSET_AUDITOR_REPORT = `${FDT_REPORTS_DIR}/asset-auditor.json`;
export const FDT_ASSET_AUDITOR_MARKDOWN = `${FDT_REPORTS_DIR}/asset-auditor.md`;
export const FDT_RESOURCE_DOCTOR_REPORT = `${FDT_REPORTS_DIR}/resource-doctor.json`;
export const FDT_CONTENT_VALIDATION_REPORT = `${FDT_REPORTS_DIR}/content-validation.json`;
export const FDT_RESOURCE_SCAN_REPORT = `${FDT_REPORTS_DIR}/resource-scan.json`;
export const FDT_RELEASES_DIR = `${FDT_OUTPUT_DIR}/releases`;
export const FDT_RELEASES_REGISTRY = `${FDT_RELEASES_DIR}/releases.json`;
export const FDT_RELEASE_DIFF_REPORT = `${FDT_REPORTS_DIR}/release-diff.json`;
export const FDT_RELEASE_CHECKLIST_REPORT = `${FDT_REPORTS_DIR}/release-checklist.json`;
export const FDT_SECURITY_REPORT = `${FDT_REPORTS_DIR}/security-audit.json`;
export const FDT_SECURITY_BASELINE = `${FDT_REPORTS_DIR}/security-baseline.json`;
export const FDT_SECURITY_SARIF = `${FDT_REPORTS_DIR}/security-audit.sarif.json`;
export const FDT_QA_DIR = `${FDT_OUTPUT_DIR}/qa`;
export const FDT_VEHICLE_SPAWN_TESTS = `${FDT_QA_DIR}/vehicle-spawn-tests.json`;
export const FDT_MAP_TEST_POINTS = `${FDT_QA_DIR}/map-test-points.json`;
export const FDT_QA_SCENARIOS_FILE = `${FDT_QA_DIR}/scenarios.json`;
export const FDT_QA_RUNS_FILE = `${FDT_QA_DIR}/runs.json`;
export const FDT_QA_VALIDATION_REPORT = `${FDT_REPORTS_DIR}/qa-validation.json`;
export const FDT_CI_PIPELINE_REPORT = `${FDT_REPORTS_DIR}/ci-pipeline.json`;
export const FDT_PERFORMANCE_DIR = `${FDT_OUTPUT_DIR}/performance`;
export const FDT_PERFORMANCE_SNAPSHOTS_FILE = `${FDT_PERFORMANCE_DIR}/snapshots.json`;
export const FDT_PERFORMANCE_COMPARISON_REPORT = `${FDT_REPORTS_DIR}/performance-comparison.json`;
export const FDT_PERFORMANCE_MARKDOWN = `${FDT_REPORTS_DIR}/performance.md`;
export const FDT_ENVIRONMENT_DIR = `${FDT_OUTPUT_DIR}/environment`;
export const FDT_ENVIRONMENT_PROFILES_FILE = `${FDT_ENVIRONMENT_DIR}/profiles.json`;
export const FDT_ENVIRONMENT_VALIDATION_REPORT = `${FDT_REPORTS_DIR}/environment-validation.json`;
export const FDT_ENVIRONMENT_DIFF_REPORT = `${FDT_REPORTS_DIR}/environment-diff.json`;
export const FDT_TXADMIN_EXPORT_DIR = `${FDT_EXPORTS_DIR}/txadmin`;
