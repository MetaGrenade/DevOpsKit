import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { addNuiCallback, addNuiMessage, loadNuiBridgeRegistry } from "./nui-bridge.js";
import { writeNuiResource } from "./nui-generator.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("nui bridge helpers", () => {
  it("adds callbacks and messages to a generated resource", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "fdt-nui-bridge-"));
    tempDirs.push(root);

    const resourceRoot = await writeNuiResource({
      workspaceRoot: root,
      resourcesRoot: "server/resources",
      resourceName: "meta_mdt",
      title: "Meta MDT",
    });

    await addNuiCallback(resourceRoot, "searchCitizen");
    await addNuiMessage(resourceRoot, "openPanel");

    const registry = await loadNuiBridgeRegistry(resourceRoot);
    expect(registry.callbacks).toEqual(["close", "ping", "searchCitizen"]);
    expect(registry.messages).toEqual(["openPanel", "setVisible"]);

    const { readFile } = await import("node:fs/promises");
    const client = await readFile(path.join(resourceRoot, "client", "main.lua"), "utf8");
    const fivem = await readFile(path.join(resourceRoot, "web", "src", "fivem.ts"), "utf8");
    const schemas = await readFile(path.join(resourceRoot, "web", "src", "schemas.ts"), "utf8");

    expect(client).toContain("RegisterNUICallback('searchCitizen'");
    expect(client).toContain("function SendOpenPanel(payload)");
    expect(fivem).toContain("export async function searchCitizen");
    expect(schemas).toContain('"searchCitizen"');
    expect(schemas).toContain('"openPanel"');
  });
});
