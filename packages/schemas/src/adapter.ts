import { z } from "zod";
import { ItemSchema } from "./item.js";
import { VehicleSchema } from "./vehicle.js";
import { BusinessSchema } from "./business.js";
import { MapPackageSchema } from "./map.js";
import { JobSchema } from "./job.js";
import { GangSchema } from "./gang.js";
import { ClothingPackSchema } from "./clothing.js";
import { ShopSchema } from "./shop.js";
import { CraftingRecipeSchema } from "./crafting.js";

export const AdapterIdSchema = z.enum([
  "custom-json",
  "qbcore",
  "qbox",
  "esx",
  "ox-inventory",
  "ox-appearance",
]);

export const FdtDomainModelSchema = z.object({
  items: z.array(ItemSchema).default([]),
  vehicles: z.array(VehicleSchema).default([]),
  businesses: z.array(BusinessSchema).default([]),
  maps: z.array(MapPackageSchema).default([]),
  jobs: z.array(JobSchema).default([]),
  gangs: z.array(GangSchema).default([]),
  clothingPacks: z.array(ClothingPackSchema).default([]),
  shops: z.array(ShopSchema).default([]),
  craftingRecipes: z.array(CraftingRecipeSchema).default([]),
});

export const AdapterExportFileSchema = z.object({
  relativePath: z.string(),
  content: z.string(),
});

export const AdapterExportResultSchema = z.object({
  adapterId: AdapterIdSchema,
  dryRun: z.boolean().default(false),
  files: z.array(AdapterExportFileSchema),
});

export const ContentValidationFindingSchema = z.object({
  id: z.string(),
  severity: z.enum(["error", "warning", "info"]),
  code: z.string(),
  message: z.string(),
  itemId: z.string().optional(),
  shopId: z.string().optional(),
  recipeId: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

export const ContentValidationReportSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  workspaceName: z.string(),
  workspaceRoot: z.string(),
  summary: z.object({
    itemsChecked: z.number(),
    shopsChecked: z.number().default(0),
    recipesChecked: z.number().default(0),
    errors: z.number(),
    warnings: z.number(),
    info: z.number(),
  }),
  findings: z.array(ContentValidationFindingSchema),
});

export type AdapterId = z.infer<typeof AdapterIdSchema>;
export type FdtDomainModel = z.infer<typeof FdtDomainModelSchema>;
export type AdapterExportFile = z.infer<typeof AdapterExportFileSchema>;
export type AdapterExportResult = z.infer<typeof AdapterExportResultSchema>;
export type ContentValidationFinding = z.infer<typeof ContentValidationFindingSchema>;
export type ContentValidationReport = z.infer<typeof ContentValidationReportSchema>;
