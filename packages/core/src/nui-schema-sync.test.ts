import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { addNuiCallback, validateNuiSchemaSync, syncNuiBridgeSchemas } from "./nui-bridge.js";
import { writeNuiResource } from "./nui-generator.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("nui schema sync", () => {
  it("detects drift and repairs generated bridge files", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "fdt-nui-sync-"));
    tempDirs.push(root);

    const resourceRoot = await writeNuiResource({
      workspaceRoot: root,
      resourcesRoot: "server/resources",
      resourceName: "meta_mdt",
      title: "Meta MDT",
    });

    await addNuiCallback(resourceRoot, "searchCitizen");

    const clientPath = path.join(resourceRoot, "client", "main.lua");
    const client = await (await import("node:fs/promises")).readFile(clientPath, "utf8");
    await writeFile(clientPath, client.replace("RegisterNUICallback('searchCitizen'", "RegisterNUICallback('brokenCallback'"), "utf8");

    const drift = await validateNuiSchemaSync(resourceRoot, "meta_mdt", "server/resources/meta_mdt");
    expect(drift.synced).toBe(false);
    expect(drift.findings.some((finding) => finding.code === "nui_callback_schema_drift")).toBe(true);

    await syncNuiBridgeSchemas(resourceRoot);
    const repaired = await validateNuiSchemaSync(resourceRoot, "meta_mdt", "server/resources/meta_mdt");
    expect(repaired.synced).toBe(true);
  });
});
