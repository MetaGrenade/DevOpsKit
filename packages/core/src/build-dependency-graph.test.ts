import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Resource } from "@fdt/schemas";
import { parseServerCfg } from "@fdt/scanner";
import { buildDependencyGraph, findGraphEvents, findImpactedResources } from "./build-dependency-graph.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function sampleResource(partial: Partial<Resource> & Pick<Resource, "name" | "path">): Resource {
  return {
    category: partial.category,
    manifest: partial.manifest ?? {
      type: "fxmanifest",
      games: [],
      clientScripts: [],
      serverScripts: [],
      sharedScripts: [],
      files: [],
      fileEntries: [],
      dependencies: [],
      runtimeDependencies: [],
      provides: [],
      escrowIgnore: [],
    },
    exports: [],
    events: [],
    streamAssets: [],
    warnings: [],
    errors: [],
    ...partial,
  };
}

describe("buildDependencyGraph", () => {
  it("builds manifest dependency and file reference edges", async () => {
    const graph = await buildDependencyGraph({
      workspaceName: "Test",
      workspaceRoot: "/tmp/test",
      scanResult: {
        resources: [
          sampleResource({
            name: "meta_core",
            path: "server/resources/meta_core",
            manifest: {
              type: "fxmanifest",
              games: [],
              clientScripts: ["client/main.lua"],
              serverScripts: [],
              sharedScripts: [],
              files: ["config.json"],
              fileEntries: [],
              dependencies: ["ox_lib"],
              runtimeDependencies: [],
              provides: [],
              escrowIgnore: [],
            },
          }),
          sampleResource({
            name: "meta_inventory",
            path: "server/resources/meta_inventory",
            manifest: {
              type: "fxmanifest",
              games: [],
              clientScripts: [],
              serverScripts: [],
              sharedScripts: [],
              files: [],
              fileEntries: [],
              dependencies: ["meta_core"],
              runtimeDependencies: [],
              provides: [],
              escrowIgnore: [],
            },
          }),
        ],
        resourceNames: new Map(),
        serverCfg: parseServerCfg("ensure meta_core\nensure meta_inventory", "server/server.cfg"),
      },
    });

    expect(graph.summary.dependencyEdges).toBeGreaterThanOrEqual(2);
    expect(graph.edges.some((edge) => edge.type === "references_file")).toBe(true);
    expect(graph.edges.some((edge) => edge.type === "started_by_server")).toBe(true);
    expect(findImpactedResources(graph, "meta_core").directDependents).toContain("meta_inventory");
  });

  it("extracts lua event registrations from scripts", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "fdt-graph-events-"));
    tempDirs.push(root);

    const resourcePath = path.join(root, "server", "resources", "meta_items");
    await mkdir(path.join(resourcePath, "client"), { recursive: true });
    await writeFile(
      path.join(resourcePath, "client", "main.lua"),
      "RegisterNetEvent('meta:server:GiveItem')\nTriggerServerEvent('meta:server:UseItem')",
      "utf8",
    );

    const graph = await buildDependencyGraph({
      workspaceName: "Test",
      workspaceRoot: root,
      scanResult: {
        resources: [
          sampleResource({
            name: "meta_items",
            path: "server/resources/meta_items",
            manifest: {
              type: "fxmanifest",
              games: [],
              clientScripts: ["client/main.lua"],
              serverScripts: [],
              sharedScripts: [],
              files: [],
              fileEntries: [],
              dependencies: [],
              runtimeDependencies: [],
              provides: [],
              escrowIgnore: [],
            },
          }),
        ],
        resourceNames: new Map(),
        serverCfg: parseServerCfg("", "server/server.cfg"),
      },
    });

    const matches = findGraphEvents(graph, "meta:server:GiveItem");
    expect(matches.some((edge) => edge.type === "registers_event")).toBe(true);
    expect(findGraphEvents(graph, "meta:server:UseItem").some((edge) => edge.type === "triggers_event")).toBe(true);
  });
});
