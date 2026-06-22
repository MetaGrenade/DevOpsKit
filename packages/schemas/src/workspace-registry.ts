import { z } from "zod";
import { FrameworkTargetSchema } from "./framework.js";
import { WorkspaceSchema } from "./workspace.js";
import { ServerArtifactSchema } from "./server-artifact.js";
import { FrameworkProfileSchema } from "./framework-profile.js";
export const WorkspaceRecordSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  directory: z.string().min(1),
  configPath: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const WorkspaceRegistrySchema = z.object({
  schemaVersion: z.literal(1),
  activeWorkspaceId: z.string().uuid().nullable().default(null),
  workspaces: z.array(WorkspaceRecordSchema).default([]),
});

export const CreateWorkspaceInputSchema = z.object({
  name: z.string().min(1),
  workspaceDirectory: z.string().min(1),
  serverRoot: z.string().min(1),
  resourcesRoot: z.string().min(1),
  serverCfg: z.string().min(1),
  frameworkTargets: z.array(FrameworkTargetSchema).default(["custom"]),
});

export const RegisterWorkspaceInputSchema = z.object({
  workspaceDirectory: z.string().min(1),
});

export type WorkspaceRecord = z.infer<typeof WorkspaceRecordSchema>;
export type WorkspaceRegistry = z.infer<typeof WorkspaceRegistrySchema>;
export type CreateWorkspaceInput = z.input<typeof CreateWorkspaceInputSchema>;
export type RegisterWorkspaceInput = z.input<typeof RegisterWorkspaceInputSchema>;

export const WorkspaceWithConfigSchema = WorkspaceRecordSchema.extend({
  workspace: WorkspaceSchema,
  resolvedPaths: z.object({
    serverRoot: z.string(),
    resourcesRoot: z.string(),
    serverCfg: z.string(),
    artifactOutput: z.string(),
    reportPath: z.string(),
  }),
  pathChecks: z.object({
    workspaceDirectory: z.boolean(),
    serverRoot: z.boolean(),
    resourcesRoot: z.boolean(),
    serverCfg: z.boolean(),
  }),
  serverArtifact: ServerArtifactSchema.optional(),
  frameworkProfile: FrameworkProfileSchema.optional(),
});

export type WorkspaceWithConfig = z.infer<typeof WorkspaceWithConfigSchema>;
