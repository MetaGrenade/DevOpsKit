import { z } from "zod";

export const ItemCategorySchema = z.enum([
  "food",
  "drink",
  "medical",
  "tool",
  "weapon",
  "ammo",
  "material",
  "contraband",
  "clothing",
  "vehicle_part",
  "document",
  "misc",
]);

export const ItemRaritySchema = z.enum([
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "illegal",
]);

export const ItemSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_]+$/, "Item id must use lowercase letters, numbers, and underscores"),
  label: z.string().min(1),
  description: z.string().optional(),
  category: ItemCategorySchema.default("misc"),
  icon: z.string().optional(),
  weight: z.number().min(0).default(0),
  stackable: z.boolean().default(true),
  unique: z.boolean().default(false),
  usable: z.boolean().default(false),
  durability: z
    .object({
      enabled: z.boolean(),
      decayMinutes: z.number().optional(),
    })
    .optional(),
  economy: z
    .object({
      basePrice: z.number().min(0).optional(),
      sellPrice: z.number().min(0).optional(),
      rarity: ItemRaritySchema.optional(),
    })
    .optional(),
  restrictions: z
    .object({
      jobs: z.array(z.string()).default([]),
      gangs: z.array(z.string()).default([]),
      licenses: z.array(z.string()).default([]),
    })
    .optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const ContentRegistrySchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string(),
  items: z.array(ItemSchema).default([]),
});

export type ItemCategory = z.infer<typeof ItemCategorySchema>;
export type Item = z.infer<typeof ItemSchema>;
export type ContentRegistry = z.infer<typeof ContentRegistrySchema>;
