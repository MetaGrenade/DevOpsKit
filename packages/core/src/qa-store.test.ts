import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  attachQaRunToRelease,
  createQaRun,
  importQaRunExport,
  summarizeQaForRelease,
  updateQaRunStep,
  upsertQaScenario,
} from "./qa-store.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const sampleScenario = {
  id: "spawn-smoke-test",
  label: "Spawn Smoke Test",
  category: "core",
  preconditions: ["Player can join"],
  steps: [
    { id: "spawn", type: "assertion" as const, label: "Player spawns", metadata: {} },
    { id: "move", type: "manual" as const, label: "Walk around", metadata: {} },
  ],
  expectedResults: ["No script errors"],
};

describe("qa-store", () => {
  it("creates runs, updates steps, and attaches to releases", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "fdt-qa-store-"));
    tempDirs.push(root);
    await mkdir(path.join(root, ".fdt", "qa"), { recursive: true });

    await upsertQaScenario(root, sampleScenario);
    const run = await createQaRun(root, { scenarioId: sampleScenario.id, tester: "tester-1" });

    expect(run.status).toBe("in_progress");
    expect(run.stepResults).toHaveLength(2);

    const passed = await updateQaRunStep(root, run.id, "spawn", { status: "passed" });
    expect(passed.status).toBe("in_progress");

    const completed = await updateQaRunStep(root, run.id, "move", { status: "passed", note: "OK" });
    expect(completed.status).toBe("completed");
    expect(completed.completedAt).toBeTruthy();

    const attached = await attachQaRunToRelease(root, run.id, {
      releaseId: "rel_123",
      releaseVersion: "1.0.0",
    });
    expect(attached.releaseId).toBe("rel_123");
    expect(attached.releaseVersion).toBe("1.0.0");

    const summary = await summarizeQaForRelease(root, "rel_123");
    expect(summary.totalRuns).toBe(1);
    expect(summary.completed).toBe(1);
    expect(summary.latestStatus).toBe("completed");
  });

  it("imports exported runs by id", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "fdt-qa-import-"));
    tempDirs.push(root);
    await mkdir(path.join(root, ".fdt", "qa"), { recursive: true });
    await upsertQaScenario(root, sampleScenario);

    const startedAt = new Date().toISOString();
    const exported = {
      schemaVersion: 1 as const,
      exportedAt: startedAt,
      resource: "fdt_devtools" as const,
      run: {
        id: "qa_import01",
        scenarioId: sampleScenario.id,
        scenarioLabel: sampleScenario.label,
        status: "failed" as const,
        startedAt,
        completedAt: startedAt,
        stepResults: [
          { stepId: "spawn", status: "passed" as const, updatedAt: startedAt },
          { stepId: "move", status: "failed" as const, note: "Stuck", updatedAt: startedAt },
        ],
      },
    };

    const imported = await importQaRunExport(root, exported);
    expect(imported.id).toBe("qa_import01");
    expect(imported.status).toBe("failed");

    const updated = await importQaRunExport(root, {
      ...exported,
      run: { ...exported.run, status: "completed", stepResults: exported.run.stepResults.map((step) => ({ ...step, status: "passed" as const })) },
    });
    expect(updated.status).toBe("completed");
  });
});
