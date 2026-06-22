import { z } from "zod";

export const QaStepTypeSchema = z.enum([
  "teleport",
  "interaction",
  "assertion",
  "manual",
  "command",
  "wait",
]);

export const QaStepCoordSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  heading: z.number().optional(),
});

export const QaStepSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_-]+$/, "Step id must use lowercase letters, numbers, underscores, or hyphens"),
  type: QaStepTypeSchema,
  label: z.string().min(1),
  coords: QaStepCoordSchema.optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const QaScenarioSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_-]+$/, "Scenario id must use lowercase letters, numbers, underscores, or hyphens"),
  label: z.string().min(1),
  category: z.string().default("general"),
  preconditions: z.array(z.string()).default([]),
  steps: z.array(QaStepSchema).min(1),
  expectedResults: z.array(z.string()).default([]),
});

export const QaScenarioRegistrySchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string(),
  scenarios: z.array(QaScenarioSchema).default([]),
});

export const QaStepResultStatusSchema = z.enum(["pending", "passed", "failed", "skipped"]);

export const QaStepResultSchema = z.object({
  stepId: z.string().min(1),
  status: QaStepResultStatusSchema,
  note: z.string().optional(),
  updatedAt: z.string(),
});

export const QaRunStatusSchema = z.enum(["in_progress", "completed", "failed", "cancelled"]);

export const QaRunSchema = z.object({
  id: z.string().min(1),
  scenarioId: z.string().min(1),
  scenarioLabel: z.string().optional(),
  releaseId: z.string().optional(),
  releaseVersion: z.string().optional(),
  status: QaRunStatusSchema.default("in_progress"),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  tester: z.string().optional(),
  stepResults: z.array(QaStepResultSchema).default([]),
  notes: z.string().optional(),
});

export const QaRunRegistrySchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string(),
  runs: z.array(QaRunSchema).default([]),
});

export const QaRunExportSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  exportedBy: z.string().optional(),
  resource: z.literal("fdt_devtools"),
  run: QaRunSchema,
});

export const UpdateQaRunStepInputSchema = z.object({
  stepId: z.string().min(1),
  status: QaStepResultStatusSchema,
  note: z.string().optional(),
});

export const CreateQaRunInputSchema = z.object({
  scenarioId: z.string().min(1),
  releaseId: z.string().optional(),
  releaseVersion: z.string().optional(),
  tester: z.string().optional(),
});

export const AttachQaRunInputSchema = z.object({
  releaseId: z.string().min(1),
  releaseVersion: z.string().optional(),
});

export const QaValidationReportSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  workspaceName: z.string(),
  workspaceRoot: z.string(),
  summary: z.object({
    scenariosChecked: z.number(),
    errors: z.number(),
    warnings: z.number(),
  }),
  findings: z.array(
    z.object({
      id: z.string(),
      severity: z.enum(["error", "warning"]),
      code: z.string(),
      message: z.string(),
      scenarioId: z.string().optional(),
      stepId: z.string().optional(),
    }),
  ),
});

export type QaStepType = z.infer<typeof QaStepTypeSchema>;
export type QaStepCoord = z.infer<typeof QaStepCoordSchema>;
export type QaStep = z.infer<typeof QaStepSchema>;
export type QaScenario = z.infer<typeof QaScenarioSchema>;
export type QaScenarioRegistry = z.infer<typeof QaScenarioRegistrySchema>;
export type QaStepResultStatus = z.infer<typeof QaStepResultStatusSchema>;
export type QaStepResult = z.infer<typeof QaStepResultSchema>;
export type QaRunStatus = z.infer<typeof QaRunStatusSchema>;
export type QaRun = z.infer<typeof QaRunSchema>;
export type QaRunRegistry = z.infer<typeof QaRunRegistrySchema>;
export type QaRunExport = z.infer<typeof QaRunExportSchema>;
export type QaValidationReport = z.infer<typeof QaValidationReportSchema>;
