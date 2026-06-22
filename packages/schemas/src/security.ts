import { z } from "zod";

export const SecuritySeveritySchema = z.enum(["info", "low", "medium", "high", "critical"]);
export const SecurityConfidenceSchema = z.enum(["low", "medium", "high"]);
export const SecurityCategorySchema = z.enum([
  "permissions",
  "economy",
  "inventory",
  "database",
  "filesystem",
  "network",
  "obfuscation",
  "events",
  "performance",
]);

export const SecurityFindingSchema = z.object({
  id: z.string(),
  fingerprint: z.string(),
  severity: SecuritySeveritySchema,
  confidence: SecurityConfidenceSchema,
  category: SecurityCategorySchema,
  code: z.string(),
  message: z.string(),
  resource: z.string().optional(),
  file: z.string().optional(),
  line: z.number().optional(),
  snippet: z.string().optional(),
  remediation: z.string().optional(),
  suppressed: z.boolean().default(false),
  isNew: z.boolean().default(true),
});

export const SecurityAuditReportSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  workspaceName: z.string(),
  workspaceRoot: z.string(),
  summary: z.object({
    resourcesScanned: z.number(),
    luaFilesScanned: z.number(),
    critical: z.number(),
    high: z.number(),
    medium: z.number(),
    low: z.number(),
    info: z.number(),
    suppressed: z.number(),
    newFindings: z.number(),
    newCritical: z.number(),
    newHigh: z.number(),
  }),
  findings: z.array(SecurityFindingSchema),
});

export const SecurityBaselineSchema = z.object({
  schemaVersion: z.literal(1),
  createdAt: z.string(),
  workspaceName: z.string().optional(),
  findingFingerprints: z.array(z.string()).default([]),
});

export type SecuritySeverity = z.infer<typeof SecuritySeveritySchema>;
export type SecurityConfidence = z.infer<typeof SecurityConfidenceSchema>;
export type SecurityCategory = z.infer<typeof SecurityCategorySchema>;
export type SecurityFinding = z.infer<typeof SecurityFindingSchema>;
export type SecurityAuditReport = z.infer<typeof SecurityAuditReportSchema>;
export type SecurityBaseline = z.infer<typeof SecurityBaselineSchema>;
