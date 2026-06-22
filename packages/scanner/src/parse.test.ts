import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseFxManifest } from "./parse-fxmanifest.js";
import { loadServerCfg, parseServerCfg, resolveServerCfgState } from "./parse-server-cfg.js";

const FIXTURE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../resources/sample-workspaces/basic-server",
);

describe("parseFxManifest", () => {
  it("parses common manifest directives", () => {
    const manifest = parseFxManifest(
      `
fx_version 'cerulean'
game 'gta5'
author 'Example Author'
description 'Example resource'
version '1.0.0'
lua54 'yes'
client_scripts { 'client/main.lua', 'client/utils.lua' }
server_script 'server/main.lua'
file 'html/index.html'
files { 'html/index.html' }
dependencies {
  'ox_lib',
  '/server:7290',
  '/onesync',
}
ui_page 'html/index.html'
`,
      "fxmanifest",
    );

    expect(manifest.fxVersion).toBe("cerulean");
    expect(manifest.version).toBe("1.0.0");
    expect(manifest.author).toBe("Example Author");
    expect(manifest.description).toBe("Example resource");
    expect(manifest.games).toEqual(["gta5"]);
    expect(manifest.lua54).toBe(true);
    expect(manifest.clientScripts).toEqual(["client/main.lua", "client/utils.lua"]);
    expect(manifest.dependencies).toEqual(["ox_lib"]);
    expect(manifest.runtimeDependencies).toEqual(["/server:7290", "/onesync"]);
    expect(manifest.fileEntries).toEqual(["html/index.html"]);
    expect(manifest.referencedPaths).toContain("html/index.html");
  });
});

describe("parseServerCfg", () => {
  it("parses ensure and start directives", () => {
    const result = parseServerCfg(
      `
# comment
ensure mapmanager
start meta_inventory
ensure meta_inventory
`,
      "server/server.cfg",
    );

    expect(result.started).toEqual(["meta_inventory"]);
    expect(result.ensured).toEqual(["mapmanager", "meta_inventory"]);
  });
});

describe("loadServerCfg", () => {
  it("follows exec directives and merges started resources", async () => {
    const serverCfgPath = path.join(FIXTURE_ROOT, "server", "server.cfg");

    const result = await loadServerCfg(serverCfgPath, {
      workspaceRoot: FIXTURE_ROOT,
      resourcesRoot: path.join(FIXTURE_ROOT, "server", "resources"),
    });

    expect(result.executedFiles).toEqual(["server/server.cfg", "server/resources.cfg"]);
    expect(result.started).toEqual(["ghost_resource", "meta_inventory"]);
    expect(result.ensured).toEqual(["chat", "mapmanager", "meta_inventory"]);
    expect(result.missingExecs).toEqual([]);
  });

  it("expands category folder ensures and applies stop directives", () => {
    const resourcesRoot = path.join(FIXTURE_ROOT, "server", "resources");
    const resources = [
      {
        name: "meta_inventory",
        path: "server/resources/[meta]/meta_inventory",
      },
      {
        name: "good_resource",
        path: "server/resources/[standalone]/good_resource",
      },
    ];

    const resolved = resolveServerCfgState(
      [
        {
          line: 1,
          command: "ensure",
          target: "[standalone]",
          isCategory: true,
          file: "server/resources.cfg",
        },
        {
          line: 2,
          command: "stop",
          target: "good_resource",
          isCategory: false,
          file: "server/resources.cfg",
        },
      ],
      resources,
      resourcesRoot,
      FIXTURE_ROOT,
    );

    expect(resolved.started).toEqual([]);
    expect(resolved.ensured).toEqual([]);
    expect(resolved.stopped).toEqual(["good_resource"]);
  });
});
