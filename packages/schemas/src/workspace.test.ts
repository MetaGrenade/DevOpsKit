import { describe, expect, it } from "vitest";
import { ResourceSchema, WorkspaceSchema } from "./index.js";

describe("WorkspaceSchema", () => {
  it("parses a minimal valid workspace config", () => {
    const result = WorkspaceSchema.parse({
      schemaVersion: 1,
      name: "Test Server",
      serverRoot: "./server",
      resourcesRoot: "./server/resources",
      serverCfg: "./server/server.cfg",
    });

    expect(result.name).toBe("Test Server");
    expect(result.artifactOutput).toBe("./.fdt/exports");
    expect(result.frameworkTargets).toEqual(["custom"]);
  });

  it("rejects invalid schema version", () => {
    expect(() =>
      WorkspaceSchema.parse({
        schemaVersion: 2,
        name: "Test",
        serverRoot: "./server",
        resourcesRoot: "./server/resources",
        serverCfg: "./server/server.cfg",
      }),
    ).toThrow();
  });
});

describe("ResourceSchema", () => {
  it("parses a resource with manifest metadata", () => {
    const result = ResourceSchema.parse({
      name: "meta_inventory",
      path: "./server/resources/[meta]/meta_inventory",
      manifest: {
        type: "fxmanifest",
        fxVersion: "cerulean",
        games: ["gta5"],
        clientScripts: ["client/main.lua"],
      },
    });

    expect(result.name).toBe("meta_inventory");
    expect(result.manifest.type).toBe("fxmanifest");
    expect(result.events).toEqual([]);
  });
});
