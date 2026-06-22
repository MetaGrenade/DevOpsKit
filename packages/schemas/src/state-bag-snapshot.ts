import { z } from "zod";

export const StateBagTargetKindSchema = z.enum(["player", "vehicle", "entity"]);

export const StateBagEntrySchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
  replicated: z.boolean().optional(),
  lastUpdatedMs: z.number().optional(),
  updateCount: z.number().min(0).optional(),
  stale: z.boolean().optional(),
});

export const StateBagTargetSchema = z.object({
  kind: StateBagTargetKindSchema,
  bagName: z.string().min(1),
  entityId: z.number().optional(),
  networkId: z.number().optional(),
  model: z.string().optional(),
  ownerServerId: z.number().optional(),
});

export const StateBagSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().optional(),
  exportedAt: z.string(),
  exportedBy: z.string().optional(),
  resource: z.string().default("fdt_devtools"),
  target: StateBagTargetSchema,
  entries: z.array(StateBagEntrySchema).default([]),
  watchedKeys: z.array(z.string()).default([]),
});

export const StateBagSnapshotRegistrySchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string(),
  snapshots: z.array(StateBagSnapshotSchema).default([]),
});

export const StateBagExportSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  exportedBy: z.string().optional(),
  resource: z.string().default("fdt_devtools"),
  snapshot: StateBagSnapshotSchema,
});

export type StateBagTargetKind = z.infer<typeof StateBagTargetKindSchema>;
export type StateBagEntry = z.infer<typeof StateBagEntrySchema>;
export type StateBagTarget = z.infer<typeof StateBagTargetSchema>;
export type StateBagSnapshot = z.infer<typeof StateBagSnapshotSchema>;
export type StateBagSnapshotRegistry = z.infer<typeof StateBagSnapshotRegistrySchema>;
export type StateBagExport = z.infer<typeof StateBagExportSchema>;
