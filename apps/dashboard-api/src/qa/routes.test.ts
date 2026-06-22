import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { saveWorkspaceRegistry } from "../workspaces/registry-store.js";

describe("qa routes", () => {
  const previousDataDir = process.env.FDT_DATA_DIR;

  afterEach(async () => {
    if (previousDataDir === undefined) {
      delete process.env.FDT_DATA_DIR;
    } else {
      process.env.FDT_DATA_DIR = previousDataDir;
    }
  });

  it("manages scenarios, runs, and release QA summary", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "fdt-api-qa-"));
    const serverRoot = path.join(tempRoot, "server");
    await mkdir(path.join(serverRoot, "resources"), { recursive: true });
    await writeFile(path.join(serverRoot, ".fxserver-artifact-version"), "29753\n", "utf8");
    await mkdir(path.join(tempRoot, ".fdt", "reports"), { recursive: true });
    await writeFile(
      path.join(tempRoot, ".fdt", "reports", "resource-doctor.json"),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          generatedAt: new Date().toISOString(),
          workspaceName: "QA API Server",
          workspaceRoot: tempRoot,
          summary: {
            resourcesScanned: 0,
            errors: 0,
            warnings: 0,
            info: 0,
            passed: 0,
          },
          resources: [],
          serverCfg: { path: "server/server.cfg", started: [], ensured: [] },
          findings: [],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const registryDir = await mkdtemp(path.join(os.tmpdir(), "fdt-api-qa-registry-"));
    process.env.FDT_DATA_DIR = registryDir;

    await saveWorkspaceRegistry({
      schemaVersion: 1,
      activeWorkspaceId: null,
      workspaces: [],
    });

    const app = await buildApp();

    try {
      const createWorkspaceResponse = await app.inject({
        method: "POST",
        url: "/api/v1/workspaces",
        payload: {
          name: "QA API Server",
          workspaceDirectory: tempRoot,
          serverRoot,
          resourcesRoot: path.join(serverRoot, "resources"),
          serverCfg: path.join(serverRoot, "server.cfg"),
        },
      });
      expect(createWorkspaceResponse.statusCode).toBe(200);

      const scenarioResponse = await app.inject({
        method: "POST",
        url: "/api/v1/qa/scenarios",
        payload: {
          id: "api-smoke-test",
          label: "API Smoke Test",
          category: "core",
          preconditions: [],
          steps: [{ id: "check", type: "manual", label: "Verify", metadata: {} }],
          expectedResults: ["Pass"],
        },
      });
      expect(scenarioResponse.statusCode).toBe(200);

      const listScenariosResponse = await app.inject({
        method: "GET",
        url: "/api/v1/qa/scenarios",
      });
      expect(listScenariosResponse.statusCode).toBe(200);
      const listedScenarios = listScenariosResponse.json() as { scenarios: Array<{ id: string }> };
      expect(listedScenarios.scenarios.some((scenario) => scenario.id === "api-smoke-test")).toBe(true);

      const createRunResponse = await app.inject({
        method: "POST",
        url: "/api/v1/qa/runs",
        payload: { scenarioId: "api-smoke-test", tester: "api-test" },
      });
      expect(createRunResponse.statusCode).toBe(200);
      const createdRun = createRunResponse.json() as { run: { id: string } };

      const updateStepResponse = await app.inject({
        method: "PATCH",
        url: `/api/v1/qa/runs/${createdRun.run.id}/steps`,
        payload: { stepId: "check", status: "passed" },
      });
      expect(updateStepResponse.statusCode).toBe(200);
      const updatedRun = updateStepResponse.json() as { run: { status: string } };
      expect(updatedRun.run.status).toBe("completed");

      const createReleaseResponse = await app.inject({
        method: "POST",
        url: "/api/v1/releases",
        payload: { version: "0.4.0", targetEnvironment: "staging" },
      });
      expect(createReleaseResponse.statusCode).toBe(200);
      const release = createReleaseResponse.json() as { release: { id: string; version: string } };

      const attachResponse = await app.inject({
        method: "PATCH",
        url: `/api/v1/qa/runs/${createdRun.run.id}/release`,
        payload: { releaseId: release.release.id, releaseVersion: release.release.version },
      });
      expect(attachResponse.statusCode).toBe(200);

      const qaSummaryResponse = await app.inject({
        method: "GET",
        url: `/api/v1/releases/${release.release.id}/qa`,
      });
      expect(qaSummaryResponse.statusCode).toBe(200);
      const qaSummary = qaSummaryResponse.json() as {
        summary: { totalRuns: number; completed: number };
        runs: Array<{ id: string }>;
      };
      expect(qaSummary.summary.totalRuns).toBe(1);
      expect(qaSummary.summary.completed).toBe(1);
      expect(qaSummary.runs[0]?.id).toBe(createdRun.run.id);
    } finally {
      await app.close();
      await rm(tempRoot, { recursive: true, force: true });
      await rm(registryDir, { recursive: true, force: true });
    }
  });
});
