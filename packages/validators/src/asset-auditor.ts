import {
  AssetBudgetSchema,
  type AssetAuditorReport,
  type AssetBudget,
  type AssetScanReport,
  type DuplicateAssetGroup,
  type Workspace,
} from "@fdt/schemas";
import { scanStreamAssets, type ScanStreamAssetsResult } from "@fdt/scanner";

export interface AuditStreamAssetsOptions {
  workspaceRoot: string;
  workspace: Workspace;
  scanResult?: ScanStreamAssetsResult;
  budget?: AssetBudget;
}

function bytesToMb(bytes: number): number {
  return bytes / (1024 * 1024);
}

function resolveBudget(workspace: Workspace, override?: AssetBudget): AssetBudget {
  return AssetBudgetSchema.parse({
    maxResourceMb: 250,
    maxYtdMb: 16,
    ...workspace.assetBudget,
    ...override,
  });
}

function groupDuplicates(assets: ScanStreamAssetsResult["assets"]): DuplicateAssetGroup[] {
  const groups = new Map<string, DuplicateAssetGroup>();

  for (const asset of assets) {
    const key = asset.fileName.toLowerCase();
    const group = groups.get(key) ?? { fileName: asset.fileName, occurrences: [] };
    group.occurrences.push({
      id: asset.id,
      resource: asset.resource,
      relativePath: asset.relativePath,
      sizeBytes: asset.sizeBytes,
    });
    groups.set(key, group);
  }

  return [...groups.values()]
    .filter((group) => group.occurrences.length > 1)
    .sort((a, b) => a.fileName.localeCompare(b.fileName));
}

export async function auditStreamAssets(
  options: AuditStreamAssetsOptions,
): Promise<AssetAuditorReport> {
  const budget = resolveBudget(options.workspace, options.budget);
  const scan =
    options.scanResult ??
    (await scanStreamAssets({
      workspaceRoot: options.workspaceRoot,
      workspace: options.workspace,
    }));

  const findings: AssetAuditorReport["findings"] = [];
  let findingCounter = 0;

  const addFinding = (
    partial: Omit<AssetAuditorReport["findings"][number], "id"> & { id?: string },
  ) => {
    findingCounter += 1;
    findings.push({
      id: partial.id ?? `asset-finding-${findingCounter}`,
      severity: partial.severity,
      code: partial.code,
      message: partial.message,
      resource: partial.resource,
      file: partial.file,
      details: partial.details,
    });
  };

  const duplicateGroups = groupDuplicates(scan.assets);

  for (const group of duplicateGroups) {
    addFinding({
      severity: "warning",
      code: "asset.duplicate_filename",
      message: `Stream asset filename "${group.fileName}" appears in ${group.occurrences.length} resources`,
      file: group.fileName,
      details: {
        occurrences: group.occurrences,
      },
    });
  }

  const maxResourceBytes = budget.maxResourceMb * 1024 * 1024;
  const maxYtdBytes = budget.maxYtdMb * 1024 * 1024;
  const maxFileBytes = budget.maxFileMb ? budget.maxFileMb * 1024 * 1024 : undefined;

  for (const summary of scan.resourceSummaries) {
    if (summary.totalBytes > maxResourceBytes) {
      addFinding({
        severity: "warning",
        code: "asset.oversized_resource",
        message: `Resource "${summary.resource}" stream folder totals ${bytesToMb(summary.totalBytes).toFixed(2)} MB (budget ${budget.maxResourceMb} MB)`,
        resource: summary.resource,
        details: {
          totalBytes: summary.totalBytes,
          budgetMb: budget.maxResourceMb,
        },
      });
    }

    if (summary.ytdBytes > maxYtdBytes) {
      addFinding({
        severity: "warning",
        code: "asset.oversized_ytd_total",
        message: `Resource "${summary.resource}" YTD files total ${bytesToMb(summary.ytdBytes).toFixed(2)} MB (budget ${budget.maxYtdMb} MB)`,
        resource: summary.resource,
        details: {
          ytdBytes: summary.ytdBytes,
          budgetMb: budget.maxYtdMb,
        },
      });
    }
  }

  for (const asset of scan.assets) {
    if (maxFileBytes && asset.sizeBytes > maxFileBytes) {
      addFinding({
        severity: "warning",
        code: "asset.oversized_file",
        message: `File "${asset.fileName}" is ${bytesToMb(asset.sizeBytes).toFixed(2)} MB (budget ${budget.maxFileMb} MB)`,
        resource: asset.resource,
        file: asset.relativePath,
        details: {
          sizeBytes: asset.sizeBytes,
          budgetMb: budget.maxFileMb,
        },
      });
    }

    if (asset.extension === ".ytd" && asset.sizeBytes > maxYtdBytes) {
      addFinding({
        severity: "warning",
        code: "asset.oversized_ytd",
        message: `Texture dictionary "${asset.fileName}" is ${bytesToMb(asset.sizeBytes).toFixed(2)} MB (budget ${budget.maxYtdMb} MB)`,
        resource: asset.resource,
        file: asset.relativePath,
        details: {
          sizeBytes: asset.sizeBytes,
          budgetMb: budget.maxYtdMb,
        },
      });
    }
  }

  const errors = findings.filter((finding) => finding.severity === "error").length;
  const warnings = findings.filter((finding) => finding.severity === "warning").length;
  const info = findings.filter((finding) => finding.severity === "info").length;
  const totalBytes = scan.assets.reduce((sum, asset) => sum + asset.sizeBytes, 0);

  const baseReport: AssetScanReport = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    workspaceName: options.workspace.name,
    workspaceRoot: options.workspaceRoot,
    summary: {
      resourcesWithStream: scan.resourceSummaries.length,
      assetsIndexed: scan.assets.length,
      totalBytes,
    },
    assets: scan.assets,
    resourceSummaries: scan.resourceSummaries,
  };

  return {
    ...baseReport,
    budget,
    summary: {
      ...baseReport.summary,
      errors,
      warnings,
      info,
      duplicateFileNames: duplicateGroups.length,
    },
    duplicateGroups,
    findings,
  };
}

export function renderAssetAuditorMarkdown(report: AssetAuditorReport): string {
  const lines = [
    `# Asset Auditor — ${report.workspaceName}`,
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Summary",
    "",
    `- Resources with stream folders: ${report.summary.resourcesWithStream}`,
    `- Assets indexed: ${report.summary.assetsIndexed}`,
    `- Total stream size: ${bytesToMb(report.summary.totalBytes).toFixed(2)} MB`,
    `- Duplicate filenames: ${report.summary.duplicateFileNames}`,
    `- Warnings: ${report.summary.warnings}`,
    `- Errors: ${report.summary.errors}`,
    "",
    "## Budget",
    "",
    `- Max resource stream size: ${report.budget.maxResourceMb} MB`,
    `- Max YTD file/total: ${report.budget.maxYtdMb} MB`,
  ];

  if (report.budget.maxFileMb) {
    lines.push(`- Max single file: ${report.budget.maxFileMb} MB`);
  }

  if (report.resourceSummaries.length > 0) {
    lines.push("", "## Resource size ranking", "", "| Resource | Assets | Total MB | YTD MB |", "| --- | ---: | ---: | ---: |");
    for (const summary of report.resourceSummaries.slice(0, 25)) {
      lines.push(
        `| ${summary.resource} | ${summary.assetCount} | ${bytesToMb(summary.totalBytes).toFixed(2)} | ${bytesToMb(summary.ytdBytes).toFixed(2)} |`,
      );
    }
  }

  if (report.duplicateGroups.length > 0) {
    lines.push("", "## Duplicate filenames", "");
    for (const group of report.duplicateGroups) {
      lines.push(`### ${group.fileName}`, "");
      for (const occurrence of group.occurrences) {
        lines.push(`- ${occurrence.resource}/${occurrence.relativePath} (${occurrence.sizeBytes} bytes)`);
      }
      lines.push("");
    }
  }

  if (report.findings.length > 0) {
    lines.push("## Findings", "");
    for (const finding of report.findings) {
      const prefix = finding.resource ? `[${finding.resource}] ` : "";
      lines.push(`- **${finding.severity.toUpperCase()}** ${prefix}${finding.message}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}
