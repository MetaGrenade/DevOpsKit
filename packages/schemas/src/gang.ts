import { z } from "zod";

export const GangTypeSchema = z.enum(["gang", "organization", "crew", "custom"]);

export const GangGradeSchema = z.object({
  id: z.string().min(1),
  level: z.number().int().min(0),
  label: z.string().min(1),
  permissions: z.array(z.string()).default([]),
});

export const GangSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_]+$/, "Gang id must use lowercase letters, numbers, and underscores"),
  label: z.string().min(1),
  type: GangTypeSchema.default("gang"),
  zoneIds: z.array(z.string()).default([]),
  territoryIds: z.array(z.string()).default([]),
  grades: z.array(GangGradeSchema).default([]),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const GangRegistrySchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string(),
  gangs: z.array(GangSchema).default([]),
});

export type GangType = z.infer<typeof GangTypeSchema>;
export type GangGrade = z.infer<typeof GangGradeSchema>;
export type Gang = z.infer<typeof GangSchema>;
export type GangRegistry = z.infer<typeof GangRegistrySchema>;
