import { z } from "zod";

export const VehicleFilesSchema = z.object({
  yft: z.array(z.string()).default([]),
  ytd: z.array(z.string()).default([]),
  vehiclesMeta: z.string().optional(),
  handlingMeta: z.string().optional(),
  carcolsMeta: z.string().optional(),
  carvariationsMeta: z.string().optional(),
});

export const VehicleSchema = z.object({
  spawnName: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_]+$/, "Spawn name must use lowercase letters, numbers, and underscores"),
  displayName: z.string().min(1),
  make: z.string().optional(),
  category: z.string().default("car"),
  class: z.string().optional(),
  price: z.number().min(0).optional(),
  shop: z.string().optional(),
  handlingProfile: z.string().optional(),
  emergency: z.boolean().default(false),
  restrictedJobs: z.array(z.string()).default([]),
  files: VehicleFilesSchema.optional(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const VehicleRegistrySchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string(),
  vehicles: z.array(VehicleSchema).default([]),
});

export type Vehicle = z.infer<typeof VehicleSchema>;
export type VehicleFiles = z.infer<typeof VehicleFilesSchema>;
export type VehicleRegistry = z.infer<typeof VehicleRegistrySchema>;
