import { z } from "zod";

export const VehicleAuditFindingSchema = z.object({
  id: z.string(),
  severity: z.enum(["error", "warning", "info"]),
  code: z.string(),
  message: z.string(),
  spawnName: z.string().optional(),
  resourceName: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

export const VehicleAuditReportSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  workspaceName: z.string(),
  workspaceRoot: z.string(),
  summary: z.object({
    vehiclesChecked: z.number(),
    resourcesScanned: z.number(),
    errors: z.number(),
    warnings: z.number(),
    info: z.number(),
  }),
  findings: z.array(VehicleAuditFindingSchema),
});

export const VehicleHandlingMetricsSchema = z.object({
  spawnName: z.string(),
  resourceName: z.string().optional(),
  mass: z.number().optional(),
  driveMaxFlatVel: z.number().optional(),
  brakeForce: z.number().optional(),
  tractionMax: z.number().optional(),
});

export const VehicleHandlingComparisonSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  baseline: VehicleHandlingMetricsSchema,
  target: VehicleHandlingMetricsSchema,
  deltas: z.object({
    mass: z.number().optional(),
    driveMaxFlatVel: z.number().optional(),
    brakeForce: z.number().optional(),
    tractionMax: z.number().optional(),
  }),
  notes: z.array(z.string()).default([]),
});

export const VehicleSpawnTestSchema = z.object({
  spawnName: z.string(),
  displayName: z.string(),
  category: z.string(),
  command: z.string(),
  resourceName: z.string().optional(),
});

export const VehicleSpawnTestListSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  workspaceName: z.string(),
  tests: z.array(VehicleSpawnTestSchema),
});

export type VehicleAuditFinding = z.infer<typeof VehicleAuditFindingSchema>;
export type VehicleAuditReport = z.infer<typeof VehicleAuditReportSchema>;
export type VehicleHandlingMetrics = z.infer<typeof VehicleHandlingMetricsSchema>;
export type VehicleHandlingComparison = z.infer<typeof VehicleHandlingComparisonSchema>;
export type VehicleSpawnTest = z.infer<typeof VehicleSpawnTestSchema>;
export type VehicleSpawnTestList = z.infer<typeof VehicleSpawnTestListSchema>;
