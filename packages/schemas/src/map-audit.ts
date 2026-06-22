import { z } from "zod";
import { ZoneCoordSchema } from "./zone.js";

export const MapStreamCountsSchema = z.object({
  ymap: z.number().int().min(0).default(0),
  ytyp: z.number().int().min(0).default(0),
  ybn: z.number().int().min(0).default(0),
  ydr: z.number().int().min(0).default(0),
  ytd: z.number().int().min(0).default(0),
  other: z.number().int().min(0).default(0),
});

export const MapAuditFindingSchema = z.object({
  id: z.string(),
  severity: z.enum(["error", "warning", "info"]),
  code: z.string(),
  message: z.string(),
  mapId: z.string().optional(),
  resourceName: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

export const MapAuditReportSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  workspaceName: z.string(),
  workspaceRoot: z.string(),
  summary: z.object({
    mapsChecked: z.number(),
    resourcesScanned: z.number(),
    errors: z.number(),
    warnings: z.number(),
    info: z.number(),
  }),
  findings: z.array(MapAuditFindingSchema),
});

export const MapTestPointSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(["entrance", "interior", "exit", "teleport", "custom"]).default("teleport"),
  coords: ZoneCoordSchema,
  mapId: z.string().optional(),
  resourceName: z.string().optional(),
});

export const MapTestPointsExportSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  mapId: z.string(),
  resourceName: z.string(),
  testPoints: z.array(MapTestPointSchema),
});

export type MapStreamCounts = z.infer<typeof MapStreamCountsSchema>;
export type MapAuditFinding = z.infer<typeof MapAuditFindingSchema>;
export type MapAuditReport = z.infer<typeof MapAuditReportSchema>;
export type MapTestPoint = z.infer<typeof MapTestPointSchema>;
export type MapTestPointsExport = z.infer<typeof MapTestPointsExportSchema>;
