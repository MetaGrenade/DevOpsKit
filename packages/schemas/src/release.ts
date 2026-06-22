import { z } from "zod";

export const ReleaseStatusSchema = z.enum([
  "draft",
  "validated",
  "qa-ready",
  "qa-approved",
  "deployed",
  "rolled-back",
]);

export const ReleaseEnvironmentSchema = z.enum(["local", "dev", "staging", "production"]);

export const ReleaseValidationSummarySchema = z.object({
  errors: z.number().int().nonnegative(),
  warnings: z.number().int().nonnegative(),
  passed: z.number().int().nonnegative(),
  resourceDoctorGeneratedAt: z.string().optional(),
  contentValidationGeneratedAt: z.string().optional(),
  assetAuditorGeneratedAt: z.string().optional(),
});

export const ReleaseStatusHistoryEntrySchema = z.object({
  status: ReleaseStatusSchema,
  changedAt: z.string(),
  changedBy: z.string().optional(),
  note: z.string().optional(),
});

export const ReleaseSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  createdAt: z.string(),
  createdBy: z.string().optional(),
  sourceRef: z.string().optional(),
  targetEnvironment: ReleaseEnvironmentSchema.default("dev"),
  status: ReleaseStatusSchema.default("validated"),
  statusHistory: z.array(ReleaseStatusHistoryEntrySchema).default([]),
  changedResources: z.array(z.string()).default([]),
  changedContent: z.array(z.string()).default([]),
  changedZones: z.array(z.string()).default([]),
  changedAssets: z.array(z.string()).default([]),
  changedDatabaseMigrations: z.array(z.string()).default([]),
  validationSummary: ReleaseValidationSummarySchema,
  changelogMarkdown: z.string().default(""),
  rollbackManifest: z.string().optional(),
  bundlePath: z.string().optional(),
});

export const ReleaseRegistrySchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string(),
  releases: z.array(ReleaseSchema).default([]),
  baselineManifest: z.record(z.string()).default({}),
});

export const RollbackManifestSchema = z.object({
  schemaVersion: z.literal(1),
  releaseVersion: z.string(),
  createdAt: z.string(),
  previousBaseline: z.record(z.string()),
  changedResources: z.array(z.string()).default([]),
  changedContent: z.array(z.string()).default([]),
  changedZones: z.array(z.string()).default([]),
  changedAssets: z.array(z.string()).default([]),
});

export const CreateReleaseInputSchema = z.object({
  version: z.string().min(1),
  targetEnvironment: ReleaseEnvironmentSchema.default("dev"),
  createdBy: z.string().optional(),
  allowValidationErrors: z.boolean().default(false),
});

export const UpdateReleaseStatusInputSchema = z.object({
  status: ReleaseStatusSchema,
  changedBy: z.string().optional(),
  note: z.string().optional(),
});

export type ReleaseStatus = z.infer<typeof ReleaseStatusSchema>;
export type ReleaseEnvironment = z.infer<typeof ReleaseEnvironmentSchema>;
export type ReleaseValidationSummary = z.infer<typeof ReleaseValidationSummarySchema>;
export type ReleaseStatusHistoryEntry = z.infer<typeof ReleaseStatusHistoryEntrySchema>;
export type Release = z.infer<typeof ReleaseSchema>;
export type ReleaseRegistry = z.infer<typeof ReleaseRegistrySchema>;
export type RollbackManifest = z.infer<typeof RollbackManifestSchema>;
export type CreateReleaseInput = z.infer<typeof CreateReleaseInputSchema>;
export type UpdateReleaseStatusInput = z.infer<typeof UpdateReleaseStatusInputSchema>;
