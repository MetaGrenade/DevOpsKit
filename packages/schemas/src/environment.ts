import { z } from "zod";

export const EnvironmentKindSchema = z.enum(["local", "dev", "staging", "production"]);
export type EnvironmentKind = z.infer<typeof EnvironmentKindSchema>;

export const EnvironmentConvarSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  comment: z.string().optional(),
});
export type EnvironmentConvar = z.infer<typeof EnvironmentConvarSchema>;

export const EnvironmentSecretSchema = z.object({
  key: z.string().min(1),
  placeholder: z.string().min(1),
  description: z.string().optional(),
  requiredInProduction: z.boolean().default(true),
});
export type EnvironmentSecret = z.infer<typeof EnvironmentSecretSchema>;

export const EnvironmentDatabaseTemplateSchema = z.object({
  type: z.enum(["mysql", "mariadb", "postgres"]).default("mysql"),
  host: z.string().default("localhost"),
  port: z.number().int().positive().default(3306),
  username: z.string().default("root"),
  password: z.string().default(""),
  database: z.string().optional(),
  connectionString: z.string().optional(),
});
export type EnvironmentDatabaseTemplate = z.infer<typeof EnvironmentDatabaseTemplateSchema>;

export const EnvironmentRecipeMetaSchema = z.object({
  name: z.string().min(1),
  version: z.string().default("1.0.0"),
  author: z.string().default("FiveM DevOps Toolkit"),
  description: z.string().optional(),
});
export type EnvironmentRecipeMeta = z.infer<typeof EnvironmentRecipeMetaSchema>;

export const EnvironmentProfileSchema = z.object({
  id: z.string().min(1),
  kind: EnvironmentKindSchema,
  label: z.string().min(1),
  serverName: z.string().default("{{serverName}}"),
  maxClients: z.number().int().positive().default(48),
  onesync: z.enum(["off", "legacy", "on"]).default("on"),
  endpoint: z.string().default("0.0.0.0:30120"),
  convars: z.array(EnvironmentConvarSchema).default([]),
  secrets: z.array(EnvironmentSecretSchema).default([]),
  ensureOrderOverride: z.array(z.string()).optional(),
  extraServerCfgLines: z.array(z.string()).default([]),
  database: EnvironmentDatabaseTemplateSchema.optional(),
  recipeMeta: EnvironmentRecipeMetaSchema.optional(),
});
export type EnvironmentProfile = z.infer<typeof EnvironmentProfileSchema>;

export const EnvironmentRegistrySchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string(),
  defaultProfileId: z.string(),
  profiles: z.array(EnvironmentProfileSchema),
});
export type EnvironmentRegistry = z.infer<typeof EnvironmentRegistrySchema>;

export const EnvironmentValidationSeveritySchema = z.enum(["error", "warning", "info"]);
export type EnvironmentValidationSeverity = z.infer<typeof EnvironmentValidationSeveritySchema>;

export const EnvironmentValidationFindingSchema = z.object({
  severity: EnvironmentValidationSeveritySchema,
  code: z.string(),
  message: z.string(),
  field: z.string().optional(),
});
export type EnvironmentValidationFinding = z.infer<typeof EnvironmentValidationFindingSchema>;

export const EnvironmentValidationReportSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  workspaceName: z.string(),
  profileId: z.string(),
  profileKind: EnvironmentKindSchema,
  passed: z.boolean(),
  summary: z.object({
    errors: z.number().int().nonnegative(),
    warnings: z.number().int().nonnegative(),
    info: z.number().int().nonnegative(),
  }),
  findings: z.array(EnvironmentValidationFindingSchema),
});
export type EnvironmentValidationReport = z.infer<typeof EnvironmentValidationReportSchema>;

export const EnvironmentDiffEntrySchema = z.object({
  field: z.string(),
  from: z.string().optional(),
  to: z.string().optional(),
  changeType: z.enum(["added", "removed", "changed"]),
});
export type EnvironmentDiffEntry = z.infer<typeof EnvironmentDiffEntrySchema>;

export const EnvironmentDiffReportSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  workspaceName: z.string(),
  fromProfileId: z.string(),
  toProfileId: z.string(),
  summary: z.object({
    convarChanges: z.number().int().nonnegative(),
    secretChanges: z.number().int().nonnegative(),
    resourceOrderChanges: z.number().int().nonnegative(),
    settingChanges: z.number().int().nonnegative(),
  }),
  convars: z.array(EnvironmentDiffEntrySchema),
  secrets: z.array(EnvironmentDiffEntrySchema),
  settings: z.array(EnvironmentDiffEntrySchema),
  resourceOrder: z.object({
    added: z.array(z.string()),
    removed: z.array(z.string()),
    reordered: z.boolean(),
    from: z.array(z.string()),
    to: z.array(z.string()),
  }),
});
export type EnvironmentDiffReport = z.infer<typeof EnvironmentDiffReportSchema>;

export const GenerateEnvironmentInputSchema = z.object({
  profileId: z.string().optional(),
  env: EnvironmentKindSchema.optional(),
});
export type GenerateEnvironmentInput = z.infer<typeof GenerateEnvironmentInputSchema>;

export const CompareEnvironmentInputSchema = z.object({
  from: z.string(),
  to: z.string(),
});
export type CompareEnvironmentInput = z.infer<typeof CompareEnvironmentInputSchema>;
