import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  comparePerformanceSnapshots,
  importPerformanceSnapshot,
  listPerformanceSnapshots,
  renderPerformanceMarkdown,
  summarizePerformanceForRelease,
} from "./perf-store.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const baselineSnapshot = {
  id: "perf_baseline",
  label: "Baseline",
  environment: "staging" as const,
  capturedAt: "2025-06-01T12:00:00.000Z",
  resources: [
    { resource: "meta_inventory", avgMs: 0.4, maxMs: 2.0, memoryMb: 12, hitchCount: 0 },
    { resource: "meta_jobs", avgMs: 0.2, maxMs: 1.0, memoryMb: 8, hitchCount: 1 },
  ],
};

const targetSnapshot = {
  id: "perf_target",
  label: "Target",
  environment: "staging" as const,
  capturedAt: "2025-06-15T12:00:00.000Z",
  resources: [
    { resource: "meta_inventory", avgMs: 0.5, maxMs: 2.5, memoryMb: 13, hitchCount: 2 },
    { resource: "meta_jobs", avgMs: 0.18, maxMs: 0.9, memoryMb: 7.5, hitchCount: 0 },
  ],
};

describe("perf-store", () => {
  it("imports snapshots and compares regressions", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "fdt-perf-store-"));
    tempDirs.push(root);
    await mkdir(path.join(root, ".fdt", "performance"), { recursive: true });

    await importPerformanceSnapshot(root, baselineSnapshot);
    await importPerformanceSnapshot(root, targetSnapshot, {
      releaseId: "rel_perf",
      releaseVersion: "1.0.0",
    });

    const snapshots = await listPerformanceSnapshots(root);
    expect(snapshots).toHaveLength(2);

    const report = comparePerformanceSnapshots({
      workspaceName: "Test",
      baseline: baselineSnapshot,
      target: targetSnapshot,
      thresholdPercent: 10,
    });

    expect(report.summary.regressions).toBeGreaterThan(0);
    expect(report.changes.some((change) => change.resource === "meta_inventory")).toBe(true);
    expect(renderPerformanceMarkdown(report)).toContain("meta_inventory");

    const summary = await summarizePerformanceForRelease(root, "rel_perf");
    expect(summary.totalSnapshots).toBe(1);
    expect(summary.latestSnapshotId).toBe("perf_target");
  });
});
