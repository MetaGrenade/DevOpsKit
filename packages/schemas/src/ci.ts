import { z } from "zod";

export const CiGateIdSchema = z.enum(["validate", "security", "qa", "content", "clothing", "nui"]);

export const CiGateStatusSchema = z.enum(["passed", "failed", "warn", "skipped"]);

export const CiGateResultSchema = z.object({
  id: CiGateIdSchema,
  status: CiGateStatusSchema,
  blocking: z.boolean(),
  reportPath: z.string().optional(),
  summary: z.record(z.union([z.number(), z.string(), z.boolean()])).default({}),
  message: z.string().optional(),
});

export const CiPipelineReportSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  workspaceName: z.string(),
  workspaceRoot: z.string(),
  passed: z.boolean(),
  gates: z.array(CiGateResultSchema),
});

export type CiGateId = z.infer<typeof CiGateIdSchema>;
export type CiGateStatus = z.infer<typeof CiGateStatusSchema>;
export type CiGateResult = z.infer<typeof CiGateResultSchema>;
export type CiPipelineReport = z.infer<typeof CiPipelineReportSchema>;
