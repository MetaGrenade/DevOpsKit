import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceSchema } from "@fdt/schemas";
import { runCiPipeline } from "./ci-pipeline.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const workspace = WorkspaceSchema.parse({
  schemaVersion: 1,
  name: "CI Pipeline Test",
  serverRoot: "./server",
  resourcesRoot: "./server/resources",
  serverCfg: "./server/server.cfg",
  artifactOutput: "./.fdt/exports",
});

async function makeWorkspace(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fdt-ci-"));
  tempDirs.push(root);

  const resourcesRoot = path.join(root, "server", "resources", "[meta]", "good_resource");
  await mkdir(resourcesRoot, { recursive: true });
  await writeFile(
    path.join(resourcesRoot, "fxmanifest.lua"),
    "fx_version 'cerulean'\ngame 'gta5'\nclient_script 'client.lua'\n",
    "utf8",
  );
  await writeFile(path.join(resourcesRoot, "client.lua"), "print('ok')\n", "utf8");
  await writeFile(path.join(root, "server", "server.cfg"), 'sv_hostname "CI Test"\n', "utf8");
  await writeFile(path.join(root, "fdt.workspace.json"), `${JSON.stringify(workspace, null, 2)}\n`, "utf8");

  await mkdir(path.join(root, ".fdt", "qa"), { recursive: true });
  await writeFile(
    path.join(root, ".fdt", "qa", "scenarios.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
        scenarios: [
          {
            id: "smoke-test",
            label: "Smoke Test",
            category: "core",
            preconditions: [],
            steps: [{ id: "check", type: "manual", label: "Check", metadata: {} }],
            expectedResults: ["Pass"],
          },
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return root;
}

describe("runCiPipeline", () => {
  it("passes when blocking gates succeed and report-only validate has warnings", async () => {
    const root = await makeWorkspace();
    const report = await runCiPipeline({
      workspaceRoot: root,
      workspace,
      gates: ["validate", "qa"],
      reportOnlyGates: ["validate"],
    });

    expect(report.gates.some((gate) => gate.id === "validate")).toBe(true);
    expect(report.gates.some((gate) => gate.id === "qa" && gate.status === "passed")).toBe(true);
    expect(report.passed).toBe(true);
  });

  it("renders a GitHub Actions workflow template", async () => {
    const { renderGithubActionsWorkflow } = await import("./ci-pipeline.js");
    const workflow = renderGithubActionsWorkflow({
      workspacePath: "./my-server",
      gates: ["validate", "security", "qa", "clothing"],
      reportOnlyGates: ["validate"],
    });

    expect(workflow).toContain("fdt ci run");
    expect(workflow).toContain("./my-server");
    expect(workflow).toContain("upload-sarif");
    expect(workflow).toContain("clothing");
  });

  it("skips clothing gate when no packs are registered or discovered", async () => {
    const root = await makeWorkspace();
    const report = await runCiPipeline({
      workspaceRoot: root,
      workspace,
      gates: ["clothing"],
    });

    const clothingGate = report.gates.find((gate) => gate.id === "clothing");
    expect(clothingGate?.status).toBe("skipped");
  });
});
