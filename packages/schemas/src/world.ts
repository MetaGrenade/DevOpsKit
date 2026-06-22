import { z } from "zod";

export const WorldCoordSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  w: z.number().optional(),
});

export const BlipSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_]+$/, "Blip id must use lowercase letters, numbers, and underscores"),
  label: z.string().min(1),
  sprite: z.number().int().default(1),
  color: z.number().int().default(0),
  scale: z.number().min(0).default(0.8),
  coords: WorldCoordSchema,
  shortRange: z.boolean().default(true),
  metadata: z.record(z.unknown()).default({}),
});

export const PropPlacementSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_]+$/, "Prop id must use lowercase letters, numbers, and underscores"),
  label: z.string().min(1),
  model: z.string().min(1),
  coords: WorldCoordSchema,
  metadata: z.record(z.unknown()).default({}),
});

export const DoorSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_]+$/, "Door id must use lowercase letters, numbers, and underscores"),
  label: z.string().min(1),
  model: z.string().optional(),
  coords: WorldCoordSchema,
  locked: z.boolean().default(true),
  group: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const BlipRegistrySchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string(),
  blips: z.array(BlipSchema).default([]),
});

export const PropRegistrySchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string(),
  props: z.array(PropPlacementSchema).default([]),
});

export const DoorRegistrySchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string(),
  doors: z.array(DoorSchema).default([]),
});

export const BlipExportSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  exportedBy: z.string().optional(),
  resource: z.literal("fdt_devtools"),
  blips: z.array(BlipSchema).min(1),
});

export const PropExportSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  exportedBy: z.string().optional(),
  resource: z.literal("fdt_devtools"),
  props: z.array(PropPlacementSchema).min(1),
});

export const DoorExportSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  exportedBy: z.string().optional(),
  resource: z.literal("fdt_devtools"),
  doors: z.array(DoorSchema).min(1),
});

export const WorldExportSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  exportedBy: z.string().optional(),
  resource: z.literal("fdt_devtools"),
  blips: z.array(BlipSchema).optional(),
  props: z.array(PropPlacementSchema).optional(),
  doors: z.array(DoorSchema).optional(),
});

export type WorldCoord = z.infer<typeof WorldCoordSchema>;
export type Blip = z.infer<typeof BlipSchema>;
export type PropPlacement = z.infer<typeof PropPlacementSchema>;
export type Door = z.infer<typeof DoorSchema>;
export type BlipRegistry = z.infer<typeof BlipRegistrySchema>;
export type PropRegistry = z.infer<typeof PropRegistrySchema>;
export type DoorRegistry = z.infer<typeof DoorRegistrySchema>;
export type BlipExport = z.infer<typeof BlipExportSchema>;
export type PropExport = z.infer<typeof PropExportSchema>;
export type DoorExport = z.infer<typeof DoorExportSchema>;
export type WorldExport = z.infer<typeof WorldExportSchema>;
