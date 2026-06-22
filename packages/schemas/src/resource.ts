import { z } from "zod";

export const ResourceEventSchema = z.object({
  name: z.string(),
  direction: z.enum(["client", "server", "shared", "unknown"]),
  kind: z.enum(["register", "trigger", "handler"]),
  file: z.string(),
  line: z.number().optional(),
});

export const ResourceManifestSchema = z.object({
  type: z.enum(["fxmanifest", "legacy_resource", "missing"]),
  fxVersion: z.string().optional(),
  resourceManifestVersion: z.string().optional(),
  version: z.string().optional(),
  author: z.string().optional(),
  description: z.string().optional(),
  games: z.array(z.string()).default([]),
  lua54: z.boolean().optional(),
  serverOnly: z.boolean().optional(),
  isMap: z.boolean().optional(),
  uiPage: z.string().optional(),
  loadscreen: z.string().optional(),
  clientScripts: z.array(z.string()).default([]),
  serverScripts: z.array(z.string()).default([]),
  sharedScripts: z.array(z.string()).default([]),
  files: z.array(z.string()).default([]),
  fileEntries: z.array(z.string()).default([]),
  dependencies: z.array(z.string()).default([]),
  runtimeDependencies: z.array(z.string()).default([]),
  provides: z.array(z.string()).default([]),
  escrowIgnore: z.array(z.string()).default([]),
  raw: z.string().optional(),
});

export const ResourceSchema = z.object({
  name: z.string(),
  path: z.string(),
  category: z.string().optional(),
  manifest: ResourceManifestSchema,
  exports: z.array(z.string()).default([]),
  events: z.array(ResourceEventSchema).default([]),
  streamAssets: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  errors: z.array(z.string()).default([]),
});

export type ResourceEvent = z.infer<typeof ResourceEventSchema>;
export type ResourceManifest = z.infer<typeof ResourceManifestSchema>;
export type Resource = z.infer<typeof ResourceSchema>;
