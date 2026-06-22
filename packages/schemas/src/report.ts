import { z } from "zod";
import { ResourceSchema } from "./resource.js";
import { ServerArtifactSchema } from "./server-artifact.js";

export const FindingSeveritySchema = z.enum(["error", "warning", "info"]);

export const FindingSchema = z.object({
  id: z.string(),
  severity: FindingSeveritySchema,
  code: z.string(),
  message: z.string(),
  resource: z.string().optional(),
  file: z.string().optional(),
  manifestKey: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

export const ResourceDoctorReportSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  workspaceName: z.string(),
  workspaceRoot: z.string(),
  summary: z.object({
    resourcesScanned: z.number(),
    errors: z.number(),
    warnings: z.number(),
    info: z.number(),
    passed: z.number(),
  }),
  resources: z.array(ResourceSchema),
  serverCfg: z.object({
    path: z.string(),
    started: z.array(z.string()),
    ensured: z.array(z.string()),
  }),
  serverArtifact: ServerArtifactSchema.optional(),
  findings: z.array(FindingSchema),
});

export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type ResourceDoctorReport = z.infer<typeof ResourceDoctorReportSchema>;
