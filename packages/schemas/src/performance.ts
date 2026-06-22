import { z } from "zod";

export const PerformanceMetricNameSchema = z.enum(["avgMs", "maxMs", "memoryMb", "hitchCount"]);

export const PerformanceResourceMetricSchema = z.object({
  resource: z.string().min(1),
  avgMs: z.number().min(0).optional(),
  maxMs: z.number().min(0).optional(),
  memoryMb: z.number().min(0).optional(),
  hitchCount: z.number().min(0).optional(),
});

export const PerformanceSnapshotSourceSchema = z.enum(["manual", "profiler", "heartbeat", "import"]);

export const PerformanceEnvironmentSchema = z.enum(["local", "dev", "staging", "production"]);

export const PerformanceSnapshotSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  releaseId: z.string().optional(),
  releaseVersion: z.string().optional(),
  environment: PerformanceEnvironmentSchema.default("dev"),
  capturedAt: z.string(),
  playerCount: z.number().min(0).optional(),
  source: PerformanceSnapshotSourceSchema.default("import"),
  notes: z.string().optional(),
  resources: z.array(PerformanceResourceMetricSchema).default([]),
});

export const PerformanceSnapshotRegistrySchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string(),
  snapshots: z.array(PerformanceSnapshotSchema).default([]),
});

export const PerformanceSnapshotImportSchema = z.union([
  PerformanceSnapshotSchema,
  z.object({
    schemaVersion: z.literal(1),
    snapshot: PerformanceSnapshotSchema,
  }),
]);

export const AttachPerformanceSnapshotInputSchema = z.object({
  releaseId: z.string().min(1),
  releaseVersion: z.string().optional(),
});

export const ComparePerformanceInputSchema = z.object({
  baselineSnapshotId: z.string().min(1),
  targetSnapshotId: z.string().min(1),
  thresholdPercent: z.number().min(0).default(10),
});

export const PerformanceChangeDirectionSchema = z.enum(["regression", "improvement", "unchanged"]);

export const PerformanceComparisonChangeSchema = z.object({
  resource: z.string(),
  metric: PerformanceMetricNameSchema,
  baselineValue: z.number(),
  targetValue: z.number(),
  changePercent: z.number(),
  direction: PerformanceChangeDirectionSchema,
});

export const PerformanceComparisonReportSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  workspaceName: z.string(),
  thresholdPercent: z.number(),
  baselineSnapshotId: z.string(),
  baselineLabel: z.string().optional(),
  targetSnapshotId: z.string(),
  targetLabel: z.string().optional(),
  summary: z.object({
    resourcesCompared: z.number(),
    regressions: z.number(),
    improvements: z.number(),
    unchanged: z.number(),
  }),
  changes: z.array(PerformanceComparisonChangeSchema),
});

export type PerformanceMetricName = z.infer<typeof PerformanceMetricNameSchema>;
export type PerformanceResourceMetric = z.infer<typeof PerformanceResourceMetricSchema>;
export type PerformanceSnapshot = z.infer<typeof PerformanceSnapshotSchema>;
export type PerformanceSnapshotRegistry = z.infer<typeof PerformanceSnapshotRegistrySchema>;
export type PerformanceSnapshotImport = z.infer<typeof PerformanceSnapshotImportSchema>;
export type PerformanceComparisonChange = z.infer<typeof PerformanceComparisonChangeSchema>;
export type PerformanceComparisonReport = z.infer<typeof PerformanceComparisonReportSchema>;
