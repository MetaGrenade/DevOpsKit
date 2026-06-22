import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  QaRunExportSchema,
  QaRunRegistrySchema,
  QaRunSchema,
  QaScenarioRegistrySchema,
  QaScenarioSchema,
  type QaRun,
  type QaRunExport,
  type QaRunRegistry,
  type QaScenario,
  type QaScenarioRegistry,
  type QaStepResult,
  type QaStepResultStatus,
} from "@fdt/schemas";
import { FDT_QA_RUNS_FILE, FDT_QA_SCENARIOS_FILE } from "./workspace.js";

function emptyScenarioRegistry(): QaScenarioRegistry {
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    scenarios: [],
  };
}

function emptyRunRegistry(): QaRunRegistry {
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    runs: [],
  };
}

export function resolveQaScenariosPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, FDT_QA_SCENARIOS_FILE);
}

export function resolveQaRunsPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, FDT_QA_RUNS_FILE);
}

export async function loadQaScenarioRegistry(workspaceRoot: string): Promise<QaScenarioRegistry> {
  const scenariosPath = resolveQaScenariosPath(workspaceRoot);
  if (!existsSync(scenariosPath)) {
    return emptyScenarioRegistry();
  }

  const raw = await readFile(scenariosPath, "utf8");
  return QaScenarioRegistrySchema.parse(JSON.parse(raw));
}

export async function saveQaScenarioRegistry(
  workspaceRoot: string,
  registry: QaScenarioRegistry,
): Promise<string> {
  const scenariosPath = resolveQaScenariosPath(workspaceRoot);
  await mkdir(path.dirname(scenariosPath), { recursive: true });

  const payload: QaScenarioRegistry = {
    ...registry,
    updatedAt: new Date().toISOString(),
  };

  await writeFile(scenariosPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return scenariosPath;
}

export async function listQaScenarios(workspaceRoot: string): Promise<QaScenario[]> {
  const registry = await loadQaScenarioRegistry(workspaceRoot);
  return registry.scenarios;
}

export async function upsertQaScenario(workspaceRoot: string, scenario: QaScenario): Promise<QaScenario> {
  const parsed = QaScenarioSchema.parse(scenario);
  const registry = await loadQaScenarioRegistry(workspaceRoot);
  const index = registry.scenarios.findIndex((existing) => existing.id === parsed.id);

  if (index >= 0) {
    registry.scenarios[index] = parsed;
  } else {
    registry.scenarios.push(parsed);
  }

  registry.scenarios.sort((a, b) => a.id.localeCompare(b.id));
  await saveQaScenarioRegistry(workspaceRoot, registry);
  return parsed;
}

export async function deleteQaScenario(workspaceRoot: string, scenarioId: string): Promise<boolean> {
  const registry = await loadQaScenarioRegistry(workspaceRoot);
  const before = registry.scenarios.length;
  registry.scenarios = registry.scenarios.filter((scenario) => scenario.id !== scenarioId);

  if (registry.scenarios.length === before) {
    return false;
  }

  await saveQaScenarioRegistry(workspaceRoot, registry);
  return true;
}

export async function loadQaRunRegistry(workspaceRoot: string): Promise<QaRunRegistry> {
  const runsPath = resolveQaRunsPath(workspaceRoot);
  if (!existsSync(runsPath)) {
    return emptyRunRegistry();
  }

  const raw = await readFile(runsPath, "utf8");
  return QaRunRegistrySchema.parse(JSON.parse(raw));
}

export async function saveQaRunRegistry(workspaceRoot: string, registry: QaRunRegistry): Promise<string> {
  const runsPath = resolveQaRunsPath(workspaceRoot);
  await mkdir(path.dirname(runsPath), { recursive: true });

  const payload: QaRunRegistry = {
    ...registry,
    updatedAt: new Date().toISOString(),
  };

  await writeFile(runsPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return runsPath;
}

export function deriveQaRunStatus(stepResults: QaStepResult[]): QaRun["status"] {
  if (stepResults.some((result) => result.status === "failed")) {
    return "failed";
  }

  if (stepResults.length > 0 && stepResults.every((result) => result.status === "passed" || result.status === "skipped")) {
    return "completed";
  }

  return "in_progress";
}

export async function listQaRuns(workspaceRoot: string): Promise<QaRun[]> {
  const registry = await loadQaRunRegistry(workspaceRoot);
  return [...registry.runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function getQaRun(workspaceRoot: string, runId: string): Promise<QaRun | null> {
  const registry = await loadQaRunRegistry(workspaceRoot);
  return registry.runs.find((run) => run.id === runId) ?? null;
}

export async function listQaRunsForRelease(workspaceRoot: string, releaseId: string): Promise<QaRun[]> {
  const runs = await listQaRuns(workspaceRoot);
  return runs.filter((run) => run.releaseId === releaseId || run.releaseVersion === releaseId);
}

export interface QaReleaseSummary {
  releaseId: string;
  totalRuns: number;
  completed: number;
  failed: number;
  inProgress: number;
  latestStatus: QaRun["status"] | "none";
}

export async function summarizeQaForRelease(
  workspaceRoot: string,
  releaseId: string,
): Promise<QaReleaseSummary> {
  const runs = await listQaRunsForRelease(workspaceRoot, releaseId);

  return {
    releaseId,
    totalRuns: runs.length,
    completed: runs.filter((run) => run.status === "completed").length,
    failed: runs.filter((run) => run.status === "failed").length,
    inProgress: runs.filter((run) => run.status === "in_progress").length,
    latestStatus: runs[0]?.status ?? "none",
  };
}

export async function createQaRun(
  workspaceRoot: string,
  input: {
    scenarioId: string;
    releaseId?: string;
    releaseVersion?: string;
    tester?: string;
  },
): Promise<QaRun> {
  const scenarios = await loadQaScenarioRegistry(workspaceRoot);
  const scenario = scenarios.scenarios.find((item) => item.id === input.scenarioId);
  if (!scenario) {
    throw new Error(`Scenario not found: ${input.scenarioId}`);
  }

  const startedAt = new Date().toISOString();
  const run = QaRunSchema.parse({
    id: `qa_${randomUUID().slice(0, 8)}`,
    scenarioId: scenario.id,
    scenarioLabel: scenario.label,
    releaseId: input.releaseId,
    releaseVersion: input.releaseVersion,
    status: "in_progress",
    startedAt,
    tester: input.tester,
    stepResults: scenario.steps.map((step) => ({
      stepId: step.id,
      status: "pending" as QaStepResultStatus,
      updatedAt: startedAt,
    })),
  });

  const registry = await loadQaRunRegistry(workspaceRoot);
  registry.runs.push(run);
  await saveQaRunRegistry(workspaceRoot, registry);
  return run;
}

export async function updateQaRunStep(
  workspaceRoot: string,
  runId: string,
  stepId: string,
  input: { status: QaStepResultStatus; note?: string },
): Promise<QaRun> {
  const registry = await loadQaRunRegistry(workspaceRoot);
  const index = registry.runs.findIndex((run) => run.id === runId);
  if (index < 0) {
    throw new Error(`QA run not found: ${runId}`);
  }

  const run = registry.runs[index]!;
  const stepIndex = run.stepResults.findIndex((result) => result.stepId === stepId);
  if (stepIndex < 0) {
    throw new Error(`Step not found in run: ${stepId}`);
  }

  run.stepResults[stepIndex] = {
    stepId,
    status: input.status,
    note: input.note,
    updatedAt: new Date().toISOString(),
  };

  run.status = deriveQaRunStatus(run.stepResults);
  if (run.status === "completed" || run.status === "failed") {
    run.completedAt = new Date().toISOString();
  }

  registry.runs[index] = QaRunSchema.parse(run);
  await saveQaRunRegistry(workspaceRoot, registry);
  return registry.runs[index]!;
}

export async function attachQaRunToRelease(
  workspaceRoot: string,
  runId: string,
  input: { releaseId: string; releaseVersion?: string },
): Promise<QaRun> {
  const registry = await loadQaRunRegistry(workspaceRoot);
  const index = registry.runs.findIndex((run) => run.id === runId);
  if (index < 0) {
    throw new Error(`QA run not found: ${runId}`);
  }

  const updated = QaRunSchema.parse({
    ...registry.runs[index],
    releaseId: input.releaseId,
    releaseVersion: input.releaseVersion,
  });

  registry.runs[index] = updated;
  await saveQaRunRegistry(workspaceRoot, registry);
  return updated;
}

export async function importQaRunExport(workspaceRoot: string, payload: QaRunExport): Promise<QaRun> {
  const parsed = QaRunExportSchema.parse(payload);
  const run = QaRunSchema.parse(parsed.run);
  const registry = await loadQaRunRegistry(workspaceRoot);

  const index = registry.runs.findIndex((existing) => existing.id === run.id);
  if (index >= 0) {
    registry.runs[index] = run;
  } else {
    registry.runs.push(run);
  }

  registry.runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  await saveQaRunRegistry(workspaceRoot, registry);
  return run;
}
