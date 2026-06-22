import { z } from "zod";

export const ServerArtifactSchema = z.object({
  build: z.number(),
  source: z.enum(["workspace.config", "fxserver-artifact-version", "citizen-version-json"]),
  path: z.string(),
});

export type ServerArtifact = z.infer<typeof ServerArtifactSchema>;
