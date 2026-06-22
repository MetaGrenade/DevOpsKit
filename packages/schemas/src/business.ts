import { z } from "zod";
import { ZoneCoordSchema } from "./zone.js";

export const BusinessTypeSchema = z.enum(["shop", "stash", "garage", "territory", "job", "custom"]);

export const BusinessSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_]+$/, "Business id must use lowercase letters, numbers, and underscores"),
  label: z.string().min(1),
  type: BusinessTypeSchema,
  zoneId: z.string().optional(),
  coords: ZoneCoordSchema.optional(),
  ownerJob: z.string().optional(),
  ownerGang: z.string().optional(),
  stashSlots: z.number().min(0).optional(),
  registerEnabled: z.boolean().default(false),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const BusinessRegistrySchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string(),
  businesses: z.array(BusinessSchema).default([]),
});

export type BusinessType = z.infer<typeof BusinessTypeSchema>;
export type Business = z.infer<typeof BusinessSchema>;
export type BusinessRegistry = z.infer<typeof BusinessRegistrySchema>;
