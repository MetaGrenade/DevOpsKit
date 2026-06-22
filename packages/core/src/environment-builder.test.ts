import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceSchema } from "@fdt/schemas";
import {
  buildEnvironmentDiffReport,
  generateServerCfg,
  generateTxAdminRecipe,
  validateEnvironmentProfile,
} from "./environment-builder.js";
import { initEnvironmentProfiles, loadEnvironmentRegistry } from "./environment-store.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeWorkspace() {
  const root = await mkdtemp(path.join(os.tmpdir(), "fdt-env-"));
  tempDirs.push(root);

  const resourcesRoot = path.join(root, "server", "resources", "[core]", "demo_resource");
  await mkdir(resourcesRoot, { recursive: true });
  await writeFile(
    path.join(resourcesRoot, "fxmanifest.lua"),
    "fx_version 'cerulean'\ngame 'gta5'\n",
    "utf8",
  );

  await writeFile(
    path.join(root, "server", "server.cfg"),
    "ensure demo_resource\n",
    "utf8",
  );

  const workspace = WorkspaceSchema.parse({
    schemaVersion: 1,
    name: "Environment Test",
    serverRoot: "./server",
    resourcesRoot: "./server/resources",
    serverCfg: "./server/server.cfg",
    artifactOutput: "./.fdt/exports",
    database: { type: "mysql", connectionName: "fivem" },
  });

  return { root, workspace };
}

describe("environment builder", () => {
  it("initializes default profiles for all kinds", async () => {
    const { root, workspace } = await makeWorkspace();
    const registry = await initEnvironmentProfiles(root, workspace);

    expect(registry.profiles).toHaveLength(4);
    expect(registry.profiles.map((profile) => profile.kind).sort()).toEqual([
      "dev",
      "local",
      "production",
      "staging",
    ]);
  });

  it("generates deterministic server.cfg and txAdmin recipe", async () => {
    const { root, workspace } = await makeWorkspace();
    await initEnvironmentProfiles(root, workspace);

    const registry = await loadEnvironmentRegistry(root);
    const dev = registry.profiles.find((profile) => profile.kind === "dev")!;

    const firstCfg = await generateServerCfg(root, workspace, dev);
    const secondCfg = await generateServerCfg(root, workspace, dev);
    expect(firstCfg.content).toBe(secondCfg.content);
    expect(firstCfg.ensureOrder).toContain("demo_resource");

    const recipe = await generateTxAdminRecipe(root, workspace, dev);
    expect(recipe.content).toContain("name:");
    expect(recipe.content).toContain("action: write_file");
    expect(recipe.content).toContain("ensure demo_resource");

    const recipeFile = await readFile(recipe.outputPath, "utf8");
    expect(recipeFile).toBe(recipe.content);
  });

  it("flags unresolved production placeholders during validation", async () => {
    const { root, workspace } = await makeWorkspace();
    await initEnvironmentProfiles(root, workspace);

    const registry = await loadEnvironmentRegistry(root);
    const production = registry.profiles.find((profile) => profile.kind === "production")!;
    production.convars.push({ key: "custom_api_key", value: "{{missingSecret}}" });

    const report = validateEnvironmentProfile(workspace.name, production);
    expect(report.passed).toBe(false);
    expect(report.findings.some((finding) => finding.code === "unresolved_placeholder")).toBe(true);
  });

  it("diffs convars and settings between environments", async () => {
    const { root, workspace } = await makeWorkspace();
    await initEnvironmentProfiles(root, workspace);

    const report = await buildEnvironmentDiffReport(root, workspace, "dev", "production");
    expect(report.fromProfileId).toBe("dev");
    expect(report.toProfileId).toBe("production");
    expect(report.summary.settingChanges).toBeGreaterThan(0);
    expect(report.resourceOrder.from).toContain("demo_resource");
  });
});
