import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Release, ReleaseChecklistReport, ReleaseDiffReport } from "@fdt/schemas";
import { ReleaseChecklistReportSchema, ReleaseDiffReportSchema } from "@fdt/schemas";
import { getRelease, resolveReleaseBundleDir } from "./release-store.js";
import { summarizePerformanceForRelease } from "./perf-store.js";
import { summarizeQaForRelease } from "./qa-store.js";
import {
  FDT_RELEASE_CHECKLIST_REPORT,
  FDT_RELEASE_DIFF_REPORT,
} from "./workspace.js";

function diffSection(fromItems: string[], toItems: string[]): ReleaseDiffReport["sections"]["resources"] {
  const fromSet = new Set(fromItems);
  const toSet = new Set(toItems);

  return {
    added: [...toSet].filter((item) => !fromSet.has(item)).sort(),
    removed: [...fromSet].filter((item) => !toSet.has(item)).sort(),
    unchanged: [...fromSet].filter((item) => toSet.has(item)).sort(),
  };
}

export function compareReleases(fromRelease: Release, toRelease: Release): ReleaseDiffReport {
  return ReleaseDiffReportSchema.parse({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    fromVersion: fromRelease.version,
    toVersion: toRelease.version,
    sections: {
      resources: diffSection(fromRelease.changedResources, toRelease.changedResources),
      content: diffSection(fromRelease.changedContent, toRelease.changedContent),
      zones: diffSection(fromRelease.changedZones, toRelease.changedZones),
      assets: diffSection(fromRelease.changedAssets, toRelease.changedAssets),
      databaseMigrations: diffSection(
        fromRelease.changedDatabaseMigrations,
        toRelease.changedDatabaseMigrations,
      ),
    },
    validation: {
      from: fromRelease.validationSummary,
      to: toRelease.validationSummary,
    },
    status: {
      from: fromRelease.status,
      to: toRelease.status,
    },
  });
}

export async function buildReleaseDiffReport(
  workspaceRoot: string,
  fromVersion: string,
  toVersion: string,
): Promise<ReleaseDiffReport> {
  const fromRelease = await getRelease(workspaceRoot, fromVersion);
  const toRelease = await getRelease(workspaceRoot, toVersion);

  if (!fromRelease) {
    throw new Error(`Release not found: ${fromVersion}`);
  }
  if (!toRelease) {
    throw new Error(`Release not found: ${toVersion}`);
  }

  return compareReleases(fromRelease, toRelease);
}

export function renderReleaseDiffMarkdown(report: ReleaseDiffReport): string {
  const lines = [
    `# Release diff ${report.fromVersion} → ${report.toVersion}`,
    "",
    `- Generated: ${report.generatedAt}`,
    `- Status: ${report.status.from} → ${report.status.to}`,
    `- Validation errors: ${report.validation.from.errors} → ${report.validation.to.errors}`,
    "",
  ];

  const sections: Array<[string, ReleaseDiffReport["sections"]["resources"]]> = [
    ["Resources", report.sections.resources],
    ["Content", report.sections.content],
    ["Zones", report.sections.zones],
    ["Stream assets", report.sections.assets],
    ["Database migrations", report.sections.databaseMigrations],
  ];

  for (const [title, section] of sections) {
    lines.push(`## ${title}`, "");
    lines.push(`- Added: ${section.added.length}`);
    lines.push(`- Removed: ${section.removed.length}`);
    lines.push(`- Unchanged: ${section.unchanged.length}`, "");

    if (section.added.length > 0) {
      lines.push("### Added", "");
      for (const item of section.added) {
        lines.push(`- ${item}`);
      }
      lines.push("");
    }

    if (section.removed.length > 0) {
      lines.push("### Removed", "");
      for (const item of section.removed) {
        lines.push(`- ${item}`);
      }
      lines.push("");
    }
  }

  return `${lines.join("\n")}\n`;
}

export async function saveReleaseDiffReport(
  workspaceRoot: string,
  report: ReleaseDiffReport,
): Promise<string> {
  const reportPath = path.join(workspaceRoot, FDT_RELEASE_DIFF_REPORT);
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

export async function buildReleaseChecklist(
  workspaceRoot: string,
  releaseVersion: string,
): Promise<ReleaseChecklistReport> {
  const release = await getRelease(workspaceRoot, releaseVersion);
  if (!release) {
    throw new Error(`Release not found: ${releaseVersion}`);
  }

  const bundleDir = resolveReleaseBundleDir(workspaceRoot, release.version);
  const bundleExists = existsSync(bundleDir);
  const rollbackExists = existsSync(path.join(bundleDir, "rollback-manifest.json"));
  const changelogExists = existsSync(path.join(bundleDir, "CHANGELOG.md"));

  const qaSummary = await summarizeQaForRelease(workspaceRoot, release.id);
  const perfSummary = await summarizePerformanceForRelease(workspaceRoot, release.id);

  const items: ReleaseChecklistReport["items"] = [
    {
      id: "validation-clean",
      label: "Resource validation has zero blocking errors",
      status: release.validationSummary.errors === 0 ? "passed" : "failed",
      blocking: true,
      message:
        release.validationSummary.errors === 0
          ? "Validation summary is clean"
          : `${release.validationSummary.errors} validation error(s) recorded`,
    },
    {
      id: "bundle-present",
      label: "Release bundle directory exists",
      status: bundleExists ? "passed" : "failed",
      blocking: true,
      message: bundleExists ? release.bundlePath : "Bundle folder missing on disk",
    },
    {
      id: "rollback-manifest",
      label: "Rollback manifest is present",
      status: rollbackExists ? "passed" : "failed",
      blocking: true,
      message: rollbackExists ? "rollback-manifest.json found" : "Rollback manifest missing",
    },
    {
      id: "changelog",
      label: "Changelog markdown is present",
      status: changelogExists ? "passed" : "warning",
      blocking: false,
      message: changelogExists ? "CHANGELOG.md found" : "Changelog missing from bundle",
    },
    {
      id: "qa-ready-status",
      label: "Release marked qa-ready or beyond",
      status: ["qa-ready", "qa-approved", "deployed"].includes(release.status) ? "passed" : "warning",
      blocking: false,
      message: `Current status: ${release.status}`,
    },
    {
      id: "qa-runs",
      label: "At least one QA run attached",
      status: qaSummary.totalRuns > 0 ? "passed" : "warning",
      blocking: false,
      message:
        qaSummary.totalRuns > 0
          ? `${qaSummary.completed} completed, ${qaSummary.failed} failed`
          : "No QA runs linked to this release",
    },
    {
      id: "qa-approved-status",
      label: "Release marked qa-approved or deployed",
      status: ["qa-approved", "deployed"].includes(release.status) ? "passed" : "skipped",
      blocking: false,
      message: `Current status: ${release.status}`,
    },
    {
      id: "performance-regressions",
      label: "No performance regressions recorded",
      status:
        perfSummary.totalSnapshots === 0
          ? "skipped"
          : perfSummary.regressions === 0
            ? "passed"
            : "failed",
      blocking: false,
      message:
        perfSummary.totalSnapshots === 0
          ? "No performance snapshots attached"
          : `${perfSummary.regressions} regression(s) detected`,
    },
  ];

  const summary = {
    passed: items.filter((item) => item.status === "passed").length,
    failed: items.filter((item) => item.status === "failed").length,
    warnings: items.filter((item) => item.status === "warning").length,
    skipped: items.filter((item) => item.status === "skipped").length,
  };

  return ReleaseChecklistReportSchema.parse({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    releaseId: release.id,
    releaseVersion: release.version,
    releaseStatus: release.status,
    passed: !items.some((item) => item.blocking && item.status === "failed"),
    summary,
    items,
  });
}

export async function saveReleaseChecklistReport(
  workspaceRoot: string,
  report: ReleaseChecklistReport,
): Promise<string> {
  const reportPath = path.join(workspaceRoot, FDT_RELEASE_CHECKLIST_REPORT);
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

export function renderReleaseChecklistMarkdown(report: ReleaseChecklistReport): string {
  const lines = [
    `# Release checklist — ${report.releaseVersion}`,
    "",
    `- Release status: ${report.releaseStatus}`,
    `- Checklist passed: ${report.passed ? "yes" : "no"}`,
    `- Passed: ${report.summary.passed}`,
    `- Failed: ${report.summary.failed}`,
    `- Warnings: ${report.summary.warnings}`,
    `- Skipped: ${report.summary.skipped}`,
    "",
    "## Items",
    "",
  ];

  for (const item of report.items) {
    const marker =
      item.status === "passed" ? "[x]" : item.status === "failed" ? "[!]" : item.status === "warning" ? "[~]" : "[ ]";
    lines.push(`- ${marker} ${item.label}${item.blocking ? " (blocking)" : ""}`);
    if (item.message) {
      lines.push(`  - ${item.message}`);
    }
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

export async function exportReleaseBundle(options: {
  workspaceRoot: string;
  releaseVersion: string;
  outputDir: string;
}): Promise<{ sourceDir: string; outputDir: string; filesCopied: number }> {
  const release = await getRelease(options.workspaceRoot, options.releaseVersion);
  if (!release) {
    throw new Error(`Release not found: ${options.releaseVersion}`);
  }

  const sourceDir = resolveReleaseBundleDir(options.workspaceRoot, release.version);
  if (!existsSync(sourceDir)) {
    throw new Error(`Release bundle not found at ${sourceDir}`);
  }

  const outputDir = path.resolve(options.workspaceRoot, options.outputDir);
  await mkdir(path.dirname(outputDir), { recursive: true });
  await cp(sourceDir, outputDir, { recursive: true, force: true });

  const manifestPath = path.join(outputDir, "bundle-manifest.json");
  const bundleManifest = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    releaseVersion: release.version,
    releaseId: release.id,
    sourceDir: release.bundlePath,
    outputDir: path.relative(options.workspaceRoot, outputDir).replace(/\\/g, "/"),
    files: ["release.json", "CHANGELOG.md", "rollback-manifest.json", "validation/resource-doctor.json"],
  };
  await writeFile(manifestPath, `${JSON.stringify(bundleManifest, null, 2)}\n`, "utf8");

  return {
    sourceDir,
    outputDir,
    filesCopied: bundleManifest.files.length + 1,
  };
}

export async function loadReleaseBundleChangelog(
  workspaceRoot: string,
  releaseVersion: string,
): Promise<string | null> {
  const bundleDir = resolveReleaseBundleDir(workspaceRoot, releaseVersion);
  const changelogPath = path.join(bundleDir, "CHANGELOG.md");
  if (!existsSync(changelogPath)) {
    return null;
  }
  return readFile(changelogPath, "utf8");
}
