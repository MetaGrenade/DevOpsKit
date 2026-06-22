import { z } from "zod";

export const STREAM_ASSET_EXTENSIONS = [
  ".ydr",
  ".ydd",
  ".yft",
  ".ytd",
  ".ymap",
  ".ytyp",
  ".ybn",
  ".ycd",
  ".ymt",
  ".meta",
  ".awc",
  ".rel",
  ".dat",
] as const;

export const StreamAssetExtensionSchema = z.enum([
  ".ydr",
  ".ydd",
  ".yft",
  ".ytd",
  ".ymap",
  ".ytyp",
  ".ybn",
  ".ycd",
  ".ymt",
  ".meta",
  ".awc",
  ".rel",
  ".dat",
]);

export const StreamAssetSchema = z.object({
  id: z.string(),
  resource: z.string(),
  resourcePath: z.string(),
  relativePath: z.string(),
  fileName: z.string(),
  extension: StreamAssetExtensionSchema,
  sizeBytes: z.number().int().nonnegative(),
});

export const AssetBudgetSchema = z.object({
  maxResourceMb: z.number().positive().default(250),
  maxYtdMb: z.number().positive().default(16),
  maxFileMb: z.number().positive().optional(),
});

export const ResourceAssetSummarySchema = z.object({
  resource: z.string(),
  resourcePath: z.string(),
  assetCount: z.number(),
  totalBytes: z.number(),
  ytdBytes: z.number(),
});

export const DuplicateAssetGroupSchema = z.object({
  fileName: z.string(),
  occurrences: z.array(
    z.object({
      id: z.string(),
      resource: z.string(),
      relativePath: z.string(),
      sizeBytes: z.number(),
    }),
  ),
});

export const AssetScanReportSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  workspaceName: z.string(),
  workspaceRoot: z.string(),
  summary: z.object({
    resourcesWithStream: z.number(),
    assetsIndexed: z.number(),
    totalBytes: z.number(),
  }),
  assets: z.array(StreamAssetSchema),
  resourceSummaries: z.array(ResourceAssetSummarySchema),
});

export const AssetAuditorReportSchema = AssetScanReportSchema.extend({
  budget: AssetBudgetSchema,
  summary: AssetScanReportSchema.shape.summary.extend({
    errors: z.number(),
    warnings: z.number(),
    info: z.number(),
    duplicateFileNames: z.number(),
  }),
  duplicateGroups: z.array(DuplicateAssetGroupSchema),
  findings: z.array(
    z.object({
      id: z.string(),
      severity: z.enum(["error", "warning", "info"]),
      code: z.string(),
      message: z.string(),
      resource: z.string().optional(),
      file: z.string().optional(),
      details: z.record(z.unknown()).optional(),
    }),
  ),
});

export type StreamAssetExtension = z.infer<typeof StreamAssetExtensionSchema>;
export type StreamAsset = z.infer<typeof StreamAssetSchema>;
export type AssetBudget = z.infer<typeof AssetBudgetSchema>;
export type ResourceAssetSummary = z.infer<typeof ResourceAssetSummarySchema>;
export type DuplicateAssetGroup = z.infer<typeof DuplicateAssetGroupSchema>;
export type AssetScanReport = z.infer<typeof AssetScanReportSchema>;
export type AssetAuditorReport = z.infer<typeof AssetAuditorReportSchema>;
