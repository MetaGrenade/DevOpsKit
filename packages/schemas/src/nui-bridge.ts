import { z } from "zod";

export const NuiFieldTypeSchema = z.enum(["string", "number", "boolean", "object", "array", "unknown"]);

export type NuiFieldDefinition = {
  type: z.infer<typeof NuiFieldTypeSchema>;
  optional?: boolean;
  properties?: Record<string, NuiFieldDefinition>;
  items?: NuiFieldDefinition;
};

export const NuiFieldDefinitionSchema: z.ZodType<NuiFieldDefinition> = z.lazy(() =>
  z.object({
    type: NuiFieldTypeSchema,
    optional: z.boolean().optional(),
    properties: z.record(NuiFieldDefinitionSchema).optional(),
    items: NuiFieldDefinitionSchema.optional(),
  }),
);

export const NuiCallbackDefinitionSchema = z.object({
  payload: z.record(NuiFieldDefinitionSchema).default({}),
  response: z.record(NuiFieldDefinitionSchema).optional(),
});

export const NuiMessageDefinitionSchema = z.object({
  payload: z.record(NuiFieldDefinitionSchema).default({}),
});

export const NuiBridgeDefinitionsSchema = z.object({
  callbacks: z.record(NuiCallbackDefinitionSchema).default({}),
  messages: z.record(NuiMessageDefinitionSchema).default({}),
});

export const NuiBridgeRegistrySchema = z.object({
  schemaVersion: z.literal(1),
  resourceName: z.string(),
  callbacks: z.array(z.string()).default([]),
  messages: z.array(z.string()).default([]),
  definitions: NuiBridgeDefinitionsSchema.optional(),
});

export const NuiSchemaSyncFindingSchema = z.object({
  id: z.string(),
  severity: z.enum(["error", "warning", "info"]),
  code: z.string(),
  message: z.string(),
  resourceName: z.string(),
  file: z.string().optional(),
});

export const NuiSchemaSyncResourceReportSchema = z.object({
  resourceName: z.string(),
  resourcePath: z.string(),
  synced: z.boolean(),
  findings: z.array(NuiSchemaSyncFindingSchema),
});

export const NuiSchemaSyncReportSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  workspaceName: z.string(),
  workspaceRoot: z.string(),
  summary: z.object({
    resourcesChecked: z.number(),
    synced: z.number(),
    errors: z.number(),
    warnings: z.number(),
  }),
  resources: z.array(NuiSchemaSyncResourceReportSchema),
});

export type NuiFieldType = z.infer<typeof NuiFieldTypeSchema>;
export type NuiCallbackDefinition = z.infer<typeof NuiCallbackDefinitionSchema>;
export type NuiMessageDefinition = z.infer<typeof NuiMessageDefinitionSchema>;
export type NuiBridgeDefinitions = z.infer<typeof NuiBridgeDefinitionsSchema>;
export type NuiBridgeRegistry = z.infer<typeof NuiBridgeRegistrySchema>;
export type NuiSchemaSyncFinding = z.infer<typeof NuiSchemaSyncFindingSchema>;
export type NuiSchemaSyncResourceReport = z.infer<typeof NuiSchemaSyncResourceReportSchema>;
export type NuiSchemaSyncReport = z.infer<typeof NuiSchemaSyncReportSchema>;
