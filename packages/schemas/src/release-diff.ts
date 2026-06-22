import { z } from "zod";
import { ReleaseValidationSummarySchema } from "./release.js";

export const ReleaseDiffSectionSchema = z.object({
  added: z.array(z.string()).default([]),
  removed: z.array(z.string()).default([]),
  unchanged: z.array(z.string()).default([]),
});

export const ReleaseDiffReportSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  fromVersion: z.string(),
  toVersion: z.string(),
  sections: z.object({
    resources: ReleaseDiffSectionSchema,
    content: ReleaseDiffSectionSchema,
    zones: ReleaseDiffSectionSchema,
    assets: ReleaseDiffSectionSchema,
    databaseMigrations: ReleaseDiffSectionSchema,
  }),
  validation: z.object({
    from: ReleaseValidationSummarySchema,
    to: ReleaseValidationSummarySchema,
  }),
  status: z.object({
    from: z.string(),
    to: z.string(),
  }),
});

export const ReleaseChecklistItemStatusSchema = z.enum(["passed", "failed", "warning", "skipped"]);

export const ReleaseChecklistItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  status: ReleaseChecklistItemStatusSchema,
  blocking: z.boolean().default(true),
  message: z.string().optional(),
});

export const ReleaseChecklistReportSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  releaseId: z.string(),
  releaseVersion: z.string(),
  releaseStatus: z.string(),
  passed: z.boolean(),
  summary: z.object({
    passed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    warnings: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
  }),
  items: z.array(ReleaseChecklistItemSchema),
});

export type ReleaseDiffSection = z.infer<typeof ReleaseDiffSectionSchema>;
export type ReleaseDiffReport = z.infer<typeof ReleaseDiffReportSchema>;
export type ReleaseChecklistItemStatus = z.infer<typeof ReleaseChecklistItemStatusSchema>;
export type ReleaseChecklistItem = z.infer<typeof ReleaseChecklistItemSchema>;
export type ReleaseChecklistReport = z.infer<typeof ReleaseChecklistReportSchema>;

export const ExportReleaseBundleInputSchema = z.object({
  outputDir: z.string().min(1).optional(),
});

export type ExportReleaseBundleInput = z.infer<typeof ExportReleaseBundleInputSchema>;
