import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  PerformanceComparisonReportSchema,
  PerformanceSnapshotImportSchema,
  PerformanceSnapshotRegistrySchema,
  PerformanceSnapshotSchema,
  type PerformanceComparisonReport,
  type PerformanceSnapshot,
  type PerformanceSnapshotRegistry,
} from "@fdt/schemas";
import {
  FDT_PERFORMANCE_COMPARISON_REPORT,
  FDT_PERFORMANCE_SNAPSHOTS_FILE,
} from "./workspace.js";

const METRICS = ["avgMs", "maxMs", "memoryMb", "hitchCount"] as const;

function emptyRegistry(): PerformanceSnapshotRegistry {
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    snapshots: [],
  };
}

export function resolvePerformanceSnapshotsPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, FDT_PERFORMANCE_SNAPSHOTS_FILE);
}

export async function loadPerformanceSnapshotRegistry(
  workspaceRoot: string,
): Promise<PerformanceSnapshotRegistry> {
  const snapshotsPath = resolvePerformanceSnapshotsPath(workspaceRoot);
  if (!existsSync(snapshotsPath)) {
    return emptyRegistry();
  }

  const raw = await readFile(snapshotsPath, "utf8");
  return PerformanceSnapshotRegistrySchema.parse(JSON.parse(raw));
}

export async function savePerformanceSnapshotRegistry(
  workspaceRoot: string,
  registry: PerformanceSnapshotRegistry,
): Promise<string> {
  const snapshotsPath = resolvePerformanceSnapshotsPath(workspaceRoot);
  await mkdir(path.dirname(snapshotsPath), { recursive: true });

  const payload: PerformanceSnapshotRegistry = {
    ...registry,
    updatedAt: new Date().toISOString(),
  };

  await writeFile(snapshotsPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return snapshotsPath;
}

export async function listPerformanceSnapshots(workspaceRoot: string): Promise<PerformanceSnapshot[]> {
  const registry = await loadPerformanceSnapshotRegistry(workspaceRoot);
  return [...registry.snapshots].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}

export async function getPerformanceSnapshot(
  workspaceRoot: string,
  snapshotId: string,
): Promise<PerformanceSnapshot | null> {
  const registry = await loadPerformanceSnapshotRegistry(workspaceRoot);
  return registry.snapshots.find((snapshot) => snapshot.id === snapshotId) ?? null;
}

export function resolvePerformanceSnapshotRef(
  snapshots: PerformanceSnapshot[],
  ref: string,
): PerformanceSnapshot | null {
  return (
    snapshots.find((snapshot) => snapshot.id === ref) ??
    snapshots.find((snapshot) => snapshot.releaseVersion === ref) ??
    snapshots.find((snapshot) => snapshot.label === ref) ??
    null
  );
}

export async function importPerformanceSnapshot(
  workspaceRoot: string,
  payload: unknown,
  input?: {
    releaseId?: string;
    releaseVersion?: string;
    label?: string;
  },
): Promise<PerformanceSnapshot> {
  const parsed = PerformanceSnapshotImportSchema.parse(payload);
  const snapshotInput = "snapshot" in parsed ? parsed.snapshot : parsed;

  const snapshot = PerformanceSnapshotSchema.parse({
    ...snapshotInput,
    id: snapshotInput.id || `perf_${randomUUID().slice(0, 8)}`,
    label: input?.label ?? snapshotInput.label,
    releaseId: input?.releaseId ?? snapshotInput.releaseId,
    releaseVersion: input?.releaseVersion ?? snapshotInput.releaseVersion,
    source: snapshotInput.source ?? "import",
  });

  const registry = await loadPerformanceSnapshotRegistry(workspaceRoot);
  const index = registry.snapshots.findIndex((existing) => existing.id === snapshot.id);

  if (index >= 0) {
    registry.snapshots[index] = snapshot;
  } else {
    registry.snapshots.push(snapshot);
  }

  registry.snapshots.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  await savePerformanceSnapshotRegistry(workspaceRoot, registry);
  return snapshot;
}

export async function attachPerformanceSnapshotToRelease(
  workspaceRoot: string,
  snapshotId: string,
  input: { releaseId: string; releaseVersion?: string },
): Promise<PerformanceSnapshot> {
  const registry = await loadPerformanceSnapshotRegistry(workspaceRoot);
  const index = registry.snapshots.findIndex((snapshot) => snapshot.id === snapshotId);
  if (index < 0) {
    throw new Error(`Performance snapshot not found: ${snapshotId}`);
  }

  const updated = PerformanceSnapshotSchema.parse({
    ...registry.snapshots[index],
    releaseId: input.releaseId,
    releaseVersion: input.releaseVersion,
  });

  registry.snapshots[index] = updated;
  await savePerformanceSnapshotRegistry(workspaceRoot, registry);
  return updated;
}

function metricValue(
  resource: PerformanceSnapshot["resources"][number],
  metric: (typeof METRICS)[number],
): number | undefined {
  return resource[metric];
}

export function comparePerformanceSnapshots(options: {
  workspaceName: string;
  baseline: PerformanceSnapshot;
  target: PerformanceSnapshot;
  thresholdPercent?: number;
}): PerformanceComparisonReport {
  const thresholdPercent = options.thresholdPercent ?? 10;
  const baselineMap = new Map(options.baseline.resources.map((item) => [item.resource, item]));
  const targetMap = new Map(options.target.resources.map((item) => [item.resource, item]));
  const resourceNames = [...new Set([...baselineMap.keys(), ...targetMap.keys()])].sort();

  const changes: PerformanceComparisonReport["changes"] = [];

  for (const resource of resourceNames) {
    const baselineResource = baselineMap.get(resource);
    const targetResource = targetMap.get(resource);
    if (!baselineResource || !targetResource) {
      continue;
    }

    for (const metric of METRICS) {
      const baselineValue = metricValue(baselineResource, metric);
      const targetValue = metricValue(targetResource, metric);
      if (baselineValue === undefined || targetValue === undefined) {
        continue;
      }

      const changePercent =
        baselineValue === 0
          ? targetValue === 0
            ? 0
            : 100
          : ((targetValue - baselineValue) / baselineValue) * 100;

      let direction: PerformanceComparisonReport["changes"][number]["direction"] = "unchanged";
      if (Math.abs(changePercent) >= thresholdPercent) {
        direction = changePercent > 0 ? "regression" : "improvement";
      }

      changes.push({
        resource,
        metric,
        baselineValue,
        targetValue,
        changePercent: Number(changePercent.toFixed(2)),
        direction,
      });
    }
  }

  changes.sort((a, b) => {
    if (a.direction === b.direction) {
      return Math.abs(b.changePercent) - Math.abs(a.changePercent);
    }
    if (a.direction === "regression") return -1;
    if (b.direction === "regression") return 1;
    return 0;
  });

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    workspaceName: options.workspaceName,
    thresholdPercent,
    baselineSnapshotId: options.baseline.id,
    baselineLabel: options.baseline.label ?? options.baseline.releaseVersion,
    targetSnapshotId: options.target.id,
    targetLabel: options.target.label ?? options.target.releaseVersion,
    summary: {
      resourcesCompared: resourceNames.filter(
        (resource) => baselineMap.has(resource) && targetMap.has(resource),
      ).length,
      regressions: changes.filter((change) => change.direction === "regression").length,
      improvements: changes.filter((change) => change.direction === "improvement").length,
      unchanged: changes.filter((change) => change.direction === "unchanged").length,
    },
    changes,
  };
}

export async function savePerformanceComparisonReport(
  workspaceRoot: string,
  report: PerformanceComparisonReport,
): Promise<string> {
  const reportPath = path.join(workspaceRoot, FDT_PERFORMANCE_COMPARISON_REPORT);
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

export async function loadPerformanceComparisonReport(
  workspaceRoot: string,
): Promise<PerformanceComparisonReport | null> {
  const reportPath = path.join(workspaceRoot, FDT_PERFORMANCE_COMPARISON_REPORT);
  if (!existsSync(reportPath)) {
    return null;
  }

  const raw = await readFile(reportPath, "utf8");
  return PerformanceComparisonReportSchema.parse(JSON.parse(raw));
}

export interface PerformanceReleaseSummary {
  releaseId: string;
  totalSnapshots: number;
  latestSnapshotId: string | null;
  latestCapturedAt: string | null;
  regressions: number;
  status: "none" | "ok" | "regressions";
}

export async function summarizePerformanceForRelease(
  workspaceRoot: string,
  releaseId: string,
): Promise<PerformanceReleaseSummary> {
  const snapshots = await listPerformanceSnapshots(workspaceRoot);
  const releaseSnapshots = snapshots.filter(
    (snapshot) => snapshot.releaseId === releaseId || snapshot.releaseVersion === releaseId,
  );

  const latest = releaseSnapshots[0] ?? null;
  const comparison = await loadPerformanceComparisonReport(workspaceRoot);

  const regressions =
    comparison &&
    (comparison.targetSnapshotId === latest?.id ||
      releaseSnapshots.some((snapshot) => snapshot.id === comparison.targetSnapshotId))
      ? comparison.summary.regressions
      : 0;

  return {
    releaseId,
    totalSnapshots: releaseSnapshots.length,
    latestSnapshotId: latest?.id ?? null,
    latestCapturedAt: latest?.capturedAt ?? null,
    regressions,
    status:
      releaseSnapshots.length === 0 ? "none" : regressions > 0 ? "regressions" : "ok",
  };
}

export function renderPerformanceMarkdown(report: PerformanceComparisonReport): string {
  const lines = [
    `# Performance Comparison`,
    ``,
    `- Generated: ${report.generatedAt}`,
    `- Baseline: ${report.baselineLabel ?? report.baselineSnapshotId}`,
    `- Target: ${report.targetLabel ?? report.targetSnapshotId}`,
    `- Threshold: ${report.thresholdPercent}%`,
    `- Regressions: ${report.summary.regressions}`,
    `- Improvements: ${report.summary.improvements}`,
    ``,
    `| Resource | Metric | Baseline | Target | Change | Direction |`,
    `| --- | --- | ---: | ---: | ---: | --- |`,
  ];

  for (const change of report.changes) {
    lines.push(
      `| ${change.resource} | ${change.metric} | ${change.baselineValue} | ${change.targetValue} | ${change.changePercent}% | ${change.direction} |`,
    );
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}
