import { z } from "zod";

export const ZoneTypeSchema = z.enum(["sphere", "box", "poly"]);
export const ZonePurposeSchema = z.enum([
  "shop",
  "stash",
  "garage",
  "interaction",
  "territory",
  "job",
  "event",
  "custom",
]);

export const ZoneCoordSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export const ZoneRestrictionsSchema = z.object({
  jobs: z.array(z.string()).default([]),
  gangs: z.array(z.string()).default([]),
  permissions: z.array(z.string()).default([]),
});

export const ZoneSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_]+$/, "Zone id must use lowercase letters, numbers, and underscores"),
  label: z.string().min(1),
  type: ZoneTypeSchema,
  purpose: ZonePurposeSchema.default("custom"),
  coords: z.array(ZoneCoordSchema).min(1),
  heading: z.number().optional(),
  radius: z.number().positive().optional(),
  width: z.number().positive().optional(),
  length: z.number().positive().optional(),
  minZ: z.number().optional(),
  maxZ: z.number().optional(),
  restrictions: ZoneRestrictionsSchema.optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const ZoneRegistrySchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string(),
  zones: z.array(ZoneSchema).default([]),
});

export const ZoneExportSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  exportedBy: z.string().optional(),
  resource: z.literal("fdt_devtools"),
  zones: z.array(ZoneSchema).min(1),
});

export type ZoneType = z.infer<typeof ZoneTypeSchema>;
export type ZonePurpose = z.infer<typeof ZonePurposeSchema>;
export type ZoneCoord = z.infer<typeof ZoneCoordSchema>;
export type Zone = z.infer<typeof ZoneSchema>;
export type ZoneRegistry = z.infer<typeof ZoneRegistrySchema>;
export type ZoneExport = z.infer<typeof ZoneExportSchema>;
