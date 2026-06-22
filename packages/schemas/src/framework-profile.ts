import { z } from "zod";
import { AdapterIdSchema } from "./adapter.js";
import { FrameworkTargetSchema, InventorySystemSchema } from "./framework.js";

export const WorkspaceFrameworkOverrideSchema = z.object({
  framework: FrameworkTargetSchema.optional(),
  inventory: InventorySystemSchema.optional(),
});

export const FrameworkProfileSchema = z.object({
  framework: FrameworkTargetSchema,
  inventory: InventorySystemSchema,
  detectedResources: z.array(z.string()),
  recommendedAdapters: z.array(AdapterIdSchema),
  source: z.enum(["manual", "detected", "mixed"]),
  manual: WorkspaceFrameworkOverrideSchema.optional(),
  autoDetected: z.object({
    framework: FrameworkTargetSchema,
    inventory: InventorySystemSchema,
    detectedResources: z.array(z.string()),
  }),
});

export const UpdateWorkspaceFrameworkInputSchema = z.object({
  framework: FrameworkTargetSchema.optional(),
  inventory: InventorySystemSchema.optional(),
  clearManualOverride: z.boolean().optional(),
});

export type WorkspaceFrameworkOverride = z.infer<typeof WorkspaceFrameworkOverrideSchema>;
export type FrameworkProfile = z.infer<typeof FrameworkProfileSchema>;
export type UpdateWorkspaceFrameworkInput = z.infer<typeof UpdateWorkspaceFrameworkInputSchema>;
