import { z } from "zod";
import { ZoneCoordSchema } from "./zone.js";

export const MapChecklistCategorySchema = z.enum(["manifest", "stream", "data", "qa", "release"]);

export const MapChecklistItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  category: MapChecklistCategorySchema,
  required: z.boolean().default(true),
  passed: z.boolean().default(false),
  note: z.string().optional(),
});

export const MapPackageStatusSchema = z.enum(["draft", "audited", "ready"]);

export const MapPackageSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_]+$/, "Map id must use lowercase letters, numbers, and underscores"),
  label: z.string().min(1),
  resourceName: z.string().min(1),
  resourcePath: z.string().optional(),
  entrances: z.array(ZoneCoordSchema).default([]),
  checklist: z.array(MapChecklistItemSchema).default([]),
  status: MapPackageStatusSchema.default("draft"),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const MapRegistrySchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string(),
  maps: z.array(MapPackageSchema).default([]),
});

export type MapChecklistCategory = z.infer<typeof MapChecklistCategorySchema>;
export type MapChecklistItem = z.infer<typeof MapChecklistItemSchema>;
export type MapPackageStatus = z.infer<typeof MapPackageStatusSchema>;
export type MapPackage = z.infer<typeof MapPackageSchema>;
export type MapRegistry = z.infer<typeof MapRegistrySchema>;
