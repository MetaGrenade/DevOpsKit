import { z } from "zod";

export const DependencyGraphNodeTypeSchema = z.enum(["resource", "file", "external_resource", "event", "system"]);

export const DependencyGraphEdgeTypeSchema = z.enum([
  "depends_on",
  "runtime_depends_on",
  "references_file",
  "started_by_server",
  "registers_event",
  "triggers_event",
]);

export const DependencyGraphNodeSchema = z.object({
  id: z.string(),
  type: DependencyGraphNodeTypeSchema,
  label: z.string(),
  resourceName: z.string().optional(),
  path: z.string().optional(),
});

export const DependencyGraphEdgeSchema = z.object({
  id: z.string(),
  type: DependencyGraphEdgeTypeSchema,
  source: z.string(),
  target: z.string(),
  resourceName: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

export const DependencyGraphReportSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  workspaceName: z.string(),
  workspaceRoot: z.string(),
  summary: z.object({
    resources: z.number(),
    nodes: z.number(),
    edges: z.number(),
    dependencyEdges: z.number(),
    fileReferenceEdges: z.number(),
    eventEdges: z.number(),
  }),
  nodes: z.array(DependencyGraphNodeSchema),
  edges: z.array(DependencyGraphEdgeSchema),
});

export const DependencyImpactReportSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  resourceName: z.string(),
  directDependents: z.array(z.string()),
  transitiveDependents: z.array(z.string()),
});

export type DependencyGraphNodeType = z.infer<typeof DependencyGraphNodeTypeSchema>;
export type DependencyGraphEdgeType = z.infer<typeof DependencyGraphEdgeTypeSchema>;
export type DependencyGraphNode = z.infer<typeof DependencyGraphNodeSchema>;
export type DependencyGraphEdge = z.infer<typeof DependencyGraphEdgeSchema>;
export type DependencyGraphReport = z.infer<typeof DependencyGraphReportSchema>;
export type DependencyImpactReport = z.infer<typeof DependencyImpactReportSchema>;
