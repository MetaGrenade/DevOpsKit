import { z } from "zod";
import { AssetBudgetSchema } from "./asset.js";
import { WorkspaceFrameworkOverrideSchema } from "./framework-profile.js";
import { FrameworkTargetSchema } from "./framework.js";

export const WorkspaceDatabaseSchema = z.object({
  type: z.enum(["postgres", "mysql", "mariadb"]),
  connectionName: z.string(),
});

export const WorkspaceNamingSchema = z.object({
  resourcePrefix: z.string().optional(),
  forbidSpaces: z.boolean().default(true),
  caseSensitivePaths: z.boolean().default(true),
});

export const WorkspaceSchema = z.object({
  schemaVersion: z.literal(1),
  name: z.string().min(1),
  serverRoot: z.string(),
  resourcesRoot: z.string(),
  serverCfg: z.string(),
  artifactOutput: z.string().default("./.fdt/exports"),
  frameworkTargets: z.array(FrameworkTargetSchema).default(["custom"]),
  database: WorkspaceDatabaseSchema.optional(),
  rulesets: z.array(z.string()).default(["baseline"]),
  resourceIgnore: z
    .array(z.string())
    .default(["**/.git/**", "**/node_modules/**", "**/dist/**", "**/cache/**"]),
  serverArtifactBuild: z.number().int().positive().optional(),
  naming: WorkspaceNamingSchema.optional(),
  /** Manual framework/inventory override; auto-detection fills gaps when omitted */
  frameworkProfile: WorkspaceFrameworkOverrideSchema.optional(),
  /** Configurable streamed asset size budgets for the asset auditor */
  assetBudget: AssetBudgetSchema.optional(),
});

export type Workspace = z.infer<typeof WorkspaceSchema>;

export const WORKSPACE_CONFIG_FILENAMES = ["fdt.workspace.json", "fdt.config.json"] as const;
