import { describe, expect, it } from "vitest";
import { WorkspaceSchema } from "@fdt/schemas";
import { resolveWorkspaceConfigCandidates } from "./workspace.js";

describe("resolveWorkspaceConfigCandidates", () => {
  it("returns default config filenames", () => {
    const candidates = resolveWorkspaceConfigCandidates("/workspace");
    expect(candidates.some((p) => p.endsWith("fdt.workspace.json"))).toBe(true);
  });
});

describe("WorkspaceSchema via core", () => {
  it("remains framework-agnostic by default", () => {
    const workspace = WorkspaceSchema.parse({
      schemaVersion: 1,
      name: "Test",
      serverRoot: "./server",
      resourcesRoot: "./server/resources",
      serverCfg: "./server/server.cfg",
    });

    expect(workspace.frameworkTargets).toEqual(["custom"]);
  });
});
