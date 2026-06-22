import { describe, expect, it } from "vitest";
import { PerformanceComparisonReportSchema, PerformanceSnapshotSchema } from "./performance.js";

describe("PerformanceSnapshotSchema", () => {
  it("parses a profiler snapshot", () => {
    const snapshot = PerformanceSnapshotSchema.parse({
      id: "perf_baseline",
      label: "v0.3.1 staging",
      environment: "staging",
      capturedAt: new Date().toISOString(),
      resources: [{ resource: "meta_inventory", avgMs: 0.42, maxMs: 2.1, memoryMb: 12.5 }],
    });

    expect(snapshot.resources).toHaveLength(1);
  });
});

describe("PerformanceComparisonReportSchema", () => {
  it("parses a comparison report", () => {
    const report = PerformanceComparisonReportSchema.parse({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      workspaceName: "Test",
      thresholdPercent: 10,
      baselineSnapshotId: "a",
      targetSnapshotId: "b",
      summary: { resourcesCompared: 1, regressions: 1, improvements: 0, unchanged: 0 },
      changes: [
        {
          resource: "meta_inventory",
          metric: "avgMs",
          baselineValue: 0.4,
          targetValue: 0.5,
          changePercent: 25,
          direction: "regression",
        },
      ],
    });

    expect(report.summary.regressions).toBe(1);
  });
});
