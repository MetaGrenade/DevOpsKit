import path from "node:path";
import type { AssetAuditorReport, ResourceDoctorReport, SecurityAuditReport } from "@fdt/schemas";

interface ScopedReport<T> {
  workspaceDirectory: string;
  report: T;
}

let latestResourceReport: ScopedReport<ResourceDoctorReport> | null = null;
let latestAssetReport: ScopedReport<AssetAuditorReport> | null = null;
let latestSecurityReport: ScopedReport<SecurityAuditReport> | null = null;

function normalizeDirectory(directory: string): string {
  return path.resolve(directory);
}

function matchesWorkspace(cached: ScopedReport<unknown> | null, workspaceDirectory: string): boolean {
  return cached?.workspaceDirectory === normalizeDirectory(workspaceDirectory);
}

export function setResourceDoctorReport(report: ResourceDoctorReport, workspaceDirectory?: string): void {
  if (!workspaceDirectory) {
    latestResourceReport = null;
    return;
  }

  latestResourceReport = {
    workspaceDirectory: normalizeDirectory(workspaceDirectory),
    report,
  };
}

export function getResourceDoctorReport(workspaceDirectory?: string): ResourceDoctorReport | null {
  if (!workspaceDirectory) {
    return latestResourceReport?.report ?? null;
  }

  return matchesWorkspace(latestResourceReport, workspaceDirectory) ? latestResourceReport!.report : null;
}

export function clearResourceDoctorReport(): void {
  latestResourceReport = null;
}

export function setAssetAuditorReport(report: AssetAuditorReport, workspaceDirectory?: string): void {
  if (!workspaceDirectory) {
    latestAssetReport = null;
    return;
  }

  latestAssetReport = {
    workspaceDirectory: normalizeDirectory(workspaceDirectory),
    report,
  };
}

export function getAssetAuditorReport(workspaceDirectory?: string): AssetAuditorReport | null {
  if (!workspaceDirectory) {
    return latestAssetReport?.report ?? null;
  }

  return matchesWorkspace(latestAssetReport, workspaceDirectory) ? latestAssetReport!.report : null;
}

export function clearAssetAuditorReport(): void {
  latestAssetReport = null;
}

export function setSecurityAuditReport(report: SecurityAuditReport, workspaceDirectory?: string): void {
  if (!workspaceDirectory) {
    latestSecurityReport = null;
    return;
  }

  latestSecurityReport = {
    workspaceDirectory: normalizeDirectory(workspaceDirectory),
    report,
  };
}

export function getSecurityAuditReport(workspaceDirectory?: string): SecurityAuditReport | null {
  if (!workspaceDirectory) {
    return latestSecurityReport?.report ?? null;
  }

  return matchesWorkspace(latestSecurityReport, workspaceDirectory) ? latestSecurityReport!.report : null;
}

export function clearSecurityAuditReport(): void {
  latestSecurityReport = null;
}

export function clearAllReportCaches(): void {
  latestResourceReport = null;
  latestAssetReport = null;
  latestSecurityReport = null;
}
