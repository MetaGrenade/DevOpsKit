import { z } from "zod";

export const ShopTypeSchema = z.enum(["general", "job", "gang", "vehicle", "vendor", "custom"]);

export const ShopCurrencySchema = z.enum(["cash", "bank", "crypto", "item", "custom"]);

export const ShopItemEntrySchema = z.object({
  itemId: z.string().min(1),
  price: z.number().min(0),
  stock: z.number().int().optional(),
  minGrade: z.number().int().min(0).optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const ShopLocationSchema = z.object({
  coords: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
    w: z.number().optional(),
  }),
  radius: z.number().min(0).optional(),
  zoneId: z.string().optional(),
});

export const ShopSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_]+$/, "Shop id must use lowercase letters, numbers, and underscores"),
  label: z.string().min(1),
  type: ShopTypeSchema.default("general"),
  currency: ShopCurrencySchema.default("cash"),
  jobId: z.string().optional(),
  gangId: z.string().optional(),
  blip: z
    .object({
      sprite: z.number().int().optional(),
      color: z.number().int().optional(),
      label: z.string().optional(),
    })
    .optional(),
  locations: z.array(ShopLocationSchema).default([]),
  items: z.array(ShopItemEntrySchema).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export const ShopRegistrySchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string(),
  shops: z.array(ShopSchema).default([]),
});

export type ShopType = z.infer<typeof ShopTypeSchema>;
export type ShopCurrency = z.infer<typeof ShopCurrencySchema>;
export type ShopItemEntry = z.infer<typeof ShopItemEntrySchema>;
export type ShopLocation = z.infer<typeof ShopLocationSchema>;
export type Shop = z.infer<typeof ShopSchema>;
export type ShopRegistry = z.infer<typeof ShopRegistrySchema>;
