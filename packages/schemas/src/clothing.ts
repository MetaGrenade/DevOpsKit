import { z } from "zod";

export const ClothingGenderSchema = z.enum(["male", "female", "shared"]);

export const ClothingCategorySchema = z.enum([
  "face",
  "mask",
  "hair",
  "torso",
  "legs",
  "bags",
  "shoes",
  "accessory",
  "undershirt",
  "armor",
  "decals",
  "tops",
  "custom",
]);

export const ClothingPackStatusSchema = z.enum(["draft", "scanned", "ready"]);

export const ClothingPackTagSchema = z.enum(["supporter", "event", "staff", "seasonal", "custom"]);

export const ClothingTextureVariantSchema = z.object({
  id: z.string().min(1),
  textureId: z.number().int().min(0).optional(),
  label: z.string().optional(),
  fileName: z.string().min(1),
  relativePath: z.string().min(1),
  previewImage: z.string().optional(),
});

export const ClothingDrawableSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  category: ClothingCategorySchema.default("custom"),
  componentId: z.number().int().min(0).max(11).optional(),
  drawableId: z.number().int().min(0).optional(),
  gender: ClothingGenderSchema.default("shared"),
  fileName: z.string().min(1),
  relativePath: z.string().min(1),
  previewImage: z.string().optional(),
  textures: z.array(ClothingTextureVariantSchema).default([]),
  restrictedJobs: z.array(z.string()).default([]),
  restrictedGangs: z.array(z.string()).default([]),
  tags: z.array(ClothingPackTagSchema).default([]),
});

export const ClothingPackSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_]+$/, "Pack id must use lowercase letters, numbers, and underscores"),
  label: z.string().min(1),
  resourceName: z.string().min(1),
  resourcePath: z.string().optional(),
  genderScope: ClothingGenderSchema.default("shared"),
  drawables: z.array(ClothingDrawableSchema).default([]),
  tags: z.array(ClothingPackTagSchema).default([]),
  status: ClothingPackStatusSchema.default("draft"),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const ClothingRegistrySchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string(),
  packs: z.array(ClothingPackSchema).default([]),
});

export const ClothingConflictFindingSchema = z.object({
  id: z.string(),
  severity: z.enum(["error", "warning", "info"]),
  code: z.string(),
  message: z.string(),
  packId: z.string().optional(),
  drawableId: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

export const ClothingValidationReportSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  workspaceName: z.string(),
  workspaceRoot: z.string(),
  summary: z.object({
    packsChecked: z.number(),
    drawablesChecked: z.number(),
    errors: z.number(),
    warnings: z.number(),
    info: z.number(),
  }),
  findings: z.array(ClothingConflictFindingSchema),
});

export type ClothingGender = z.infer<typeof ClothingGenderSchema>;
export type ClothingCategory = z.infer<typeof ClothingCategorySchema>;
export type ClothingPackStatus = z.infer<typeof ClothingPackStatusSchema>;
export type ClothingTextureVariant = z.infer<typeof ClothingTextureVariantSchema>;
export type ClothingDrawable = z.infer<typeof ClothingDrawableSchema>;
export type ClothingPack = z.infer<typeof ClothingPackSchema>;
export type ClothingRegistry = z.infer<typeof ClothingRegistrySchema>;
export type ClothingConflictFinding = z.infer<typeof ClothingConflictFindingSchema>;
export type ClothingValidationReport = z.infer<typeof ClothingValidationReportSchema>;
