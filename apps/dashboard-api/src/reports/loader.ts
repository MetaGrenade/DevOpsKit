import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import { FDT_ASSET_AUDITOR_REPORT, FDT_REPORTS_DIR, FDT_SECURITY_REPORT } from "@fdt/core";
import {
  AssetAuditorReportSchema,
  ResourceDoctorReportSchema,
  SecurityAuditReportSchema,
  type AssetAuditorReport,
  type ResourceDoctorReport,
  type SecurityAuditReport,
} from "@fdt/schemas";
import { getMonorepoRoot, resolveFromMonorepoRoot } from "../monorepo-root.js";

export interface LoadedSecurityReport {
  path: string;
  report: SecurityAuditReport;
}

export function resolveSecurityAuditReportPath(workspaceRoot: string): string {
  return path.resolve(workspaceRoot, FDT_SECURITY_REPORT);
}

export async function loadSecurityAuditReportFromWorkspace(
  workspaceRoot: string,
): Promise<LoadedSecurityReport | null> {
  const reportPath = resolveSecurityAuditReportPath(workspaceRoot);
  if (!existsSync(reportPath)) {
    return null;
  }

  const raw = await readFile(reportPath, "utf8");
  const report = SecurityAuditReportSchema.parse(JSON.parse(raw));
  return { path: reportPath, report };
}

export async function resolveSecurityAuditReport(
  options: ResolveReportOptions = {},
): Promise<LoadedSecurityReport | null> {
  const monorepoRoot = getMonorepoRoot();
  const workspaceRootEnv = options.workspaceRoot ?? process.env.FDT_WORKSPACE_ROOT;

  if (workspaceRootEnv) {
    const fromWorkspace = await loadSecurityAuditReportFromWorkspace(
      resolveFromMonorepoRoot(workspaceRootEnv, monorepoRoot),
    );
    if (fromWorkspace) {
      return fromWorkspace;
    }
  }

  const searchRootEnv = options.searchRoot ?? process.env.FDT_REPO_ROOT;
  const searchRoot = searchRootEnv
    ? resolveFromMonorepoRoot(searchRootEnv, monorepoRoot)
    : monorepoRoot;

  const files = await fg("**/.fdt/reports/security-audit.json", {
    cwd: searchRoot,
    absolute: true,
    onlyFiles: true,
    ignore: ["**/node_modules/**", "**/dist/**"],
  });

  let latestPath: string | null = null;
  let latestMtime = 0;

  for (const file of files) {
    const fileStat = await stat(file);
    if (fileStat.mtimeMs > latestMtime) {
      latestMtime = fileStat.mtimeMs;
      latestPath = file;
    }
  }

  if (!latestPath) {
    return null;
  }

  const raw = await readFile(latestPath, "utf8");
  const report = SecurityAuditReportSchema.parse(JSON.parse(raw));
  return { path: latestPath, report };
}

export interface LoadedAssetReport {
  path: string;
  report: AssetAuditorReport;
}

export function resolveAssetAuditorReportPath(workspaceRoot: string): string {
  return path.resolve(workspaceRoot, FDT_ASSET_AUDITOR_REPORT);
}

export async function loadAssetAuditorReportFromWorkspace(
  workspaceRoot: string,
): Promise<LoadedAssetReport | null> {
  const reportPath = resolveAssetAuditorReportPath(workspaceRoot);
  if (!existsSync(reportPath)) {
    return null;
  }

  const raw = await readFile(reportPath, "utf8");
  const report = AssetAuditorReportSchema.parse(JSON.parse(raw));
  return { path: reportPath, report };
}

export async function resolveAssetAuditorReport(
  options: ResolveReportOptions = {},
): Promise<LoadedAssetReport | null> {
  const monorepoRoot = getMonorepoRoot();
  const workspaceRootEnv = options.workspaceRoot ?? process.env.FDT_WORKSPACE_ROOT;

  if (workspaceRootEnv) {
    const fromWorkspace = await loadAssetAuditorReportFromWorkspace(
      resolveFromMonorepoRoot(workspaceRootEnv, monorepoRoot),
    );
    if (fromWorkspace) {
      return fromWorkspace;
    }
  }

  const searchRootEnv = options.searchRoot ?? process.env.FDT_REPO_ROOT;
  const searchRoot = searchRootEnv
    ? resolveFromMonorepoRoot(searchRootEnv, monorepoRoot)
    : monorepoRoot;

  const files = await fg("**/.fdt/reports/asset-auditor.json", {
    cwd: searchRoot,
    absolute: true,
    onlyFiles: true,
    ignore: ["**/node_modules/**", "**/dist/**"],
  });

  let latestPath: string | null = null;
  let latestMtime = 0;

  for (const file of files) {
    const fileStat = await stat(file);
    if (fileStat.mtimeMs > latestMtime) {
      latestMtime = fileStat.mtimeMs;
      latestPath = file;
    }
  }

  if (!latestPath) {
    return null;
  }

  const raw = await readFile(latestPath, "utf8");
  const report = AssetAuditorReportSchema.parse(JSON.parse(raw));
  return { path: latestPath, report };
}

export interface LoadedReport {
  path: string;
  report: ResourceDoctorReport;
}

export function resolveResourceDoctorReportPath(workspaceRoot: string): string {
  return path.resolve(workspaceRoot, FDT_REPORTS_DIR, "resource-doctor.json");
}

export async function loadReportFromWorkspace(workspaceRoot: string): Promise<LoadedReport | null> {
  const reportPath = resolveResourceDoctorReportPath(workspaceRoot);
  if (!existsSync(reportPath)) {
    return null;
  }

  const raw = await readFile(reportPath, "utf8");
  const report = ResourceDoctorReportSchema.parse(JSON.parse(raw));
  return { path: reportPath, report };
}

export async function findLatestResourceDoctorReport(
  searchRoot: string,
): Promise<LoadedReport | null> {
  const files = await fg("**/.fdt/reports/resource-doctor.json", {
    cwd: searchRoot,
    absolute: true,
    onlyFiles: true,
    ignore: ["**/node_modules/**", "**/dist/**"],
  });

  let latestPath: string | null = null;
  let latestMtime = 0;

  for (const file of files) {
    const fileStat = await stat(file);
    if (fileStat.mtimeMs > latestMtime) {
      latestMtime = fileStat.mtimeMs;
      latestPath = file;
    }
  }

  if (!latestPath) {
    return null;
  }

  const raw = await readFile(latestPath, "utf8");
  const report = ResourceDoctorReportSchema.parse(JSON.parse(raw));
  return { path: latestPath, report };
}

export interface ResolveReportOptions {
  workspaceRoot?: string;
  searchRoot?: string;
}

export async function resolveResourceDoctorReport(
  options: ResolveReportOptions = {},
): Promise<LoadedReport | null> {
  const monorepoRoot = getMonorepoRoot();
  const workspaceRootEnv = options.workspaceRoot ?? process.env.FDT_WORKSPACE_ROOT;

  if (workspaceRootEnv) {
    const fromWorkspace = await loadReportFromWorkspace(
      resolveFromMonorepoRoot(workspaceRootEnv, monorepoRoot),
    );
    if (fromWorkspace) {
      return fromWorkspace;
    }
  }

  const searchRootEnv = options.searchRoot ?? process.env.FDT_REPO_ROOT;
  const searchRoot = searchRootEnv
    ? resolveFromMonorepoRoot(searchRootEnv, monorepoRoot)
    : monorepoRoot;

  return findLatestResourceDoctorReport(searchRoot);
}
