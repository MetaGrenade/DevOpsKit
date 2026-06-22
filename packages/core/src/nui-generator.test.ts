import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generateNuiResource, writeNuiResource } from "./nui-generator.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("generateNuiResource", () => {
  it("generates a deterministic starter resource scaffold", () => {
    const files = generateNuiResource({
      resourceName: "meta_shop_ui",
      title: "Meta Shop UI",
      mockMode: true,
    });

    expect(files.map((file) => file.relativePath)).toEqual([
      "fxmanifest.lua",
      "client/main.lua",
      "server/main.lua",
      "web/package.json",
      "web/tsconfig.json",
      "web/vite.config.ts",
      "web/index.html",
      "shared/nui-bridge.json",
      "web/src/schemas.ts",
      "web/src/messages.ts",
      "web/src/fivem.ts",
      "web/src/mock.ts",
      "web/src/App.tsx",
      "web/src/main.tsx",
      "README.md",
    ]);

    const manifest = files.find((file) => file.relativePath === "fxmanifest.lua");
    expect(manifest?.content).toContain("ui_page 'web/dist/index.html'");
    expect(manifest?.content).toContain("client/main.lua");

    const app = files.find((file) => file.relativePath === "web/src/App.tsx");
    expect(app?.content).toContain("Meta Shop UI");
    expect(app?.content).toContain("mockMode");
  });
});

describe("writeNuiResource", () => {
  it("writes generated files into the workspace resources folder", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "fdt-nui-"));
    tempDirs.push(root);

    const resourceRoot = await writeNuiResource({
      workspaceRoot: root,
      resourcesRoot: "server/resources",
      resourceName: "meta_hud",
      title: "Meta HUD",
    });

    expect(resourceRoot).toContain(path.join("server", "resources", "meta_hud"));

    const { readFile } = await import("node:fs/promises");
    const manifest = await readFile(path.join(resourceRoot, "fxmanifest.lua"), "utf8");
    expect(manifest).toContain("Meta HUD");
  });
});
