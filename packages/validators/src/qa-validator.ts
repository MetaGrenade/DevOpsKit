import type { QaScenarioRegistry, QaValidationReport } from "@fdt/schemas";
import { QaScenarioRegistrySchema, QaScenarioSchema } from "@fdt/schemas";

export interface ValidateQaOptions {
  workspaceRoot: string;
  workspaceName: string;
  registry?: QaScenarioRegistry;
}

export async function validateQaScenarios(options: ValidateQaOptions): Promise<QaValidationReport> {
  const registry = options.registry ?? QaScenarioRegistrySchema.parse({ schemaVersion: 1, updatedAt: new Date().toISOString(), scenarios: [] });
  const findings: QaValidationReport["findings"] = [];
  const scenarioIds = new Set<string>();

  for (const scenario of registry.scenarios) {
    const parsed = QaScenarioSchema.safeParse(scenario);
    if (!parsed.success) {
      findings.push({
        id: `qa-invalid-${scenario.id ?? "unknown"}`,
        severity: "error",
        code: "qa.scenario_invalid",
        message: parsed.error.message,
        scenarioId: typeof scenario.id === "string" ? scenario.id : undefined,
      });
      continue;
    }

    if (scenarioIds.has(parsed.data.id)) {
      findings.push({
        id: `qa-duplicate-${parsed.data.id}`,
        severity: "error",
        code: "qa.duplicate_scenario_id",
        message: `Duplicate scenario id: ${parsed.data.id}`,
        scenarioId: parsed.data.id,
      });
    }
    scenarioIds.add(parsed.data.id);

    const stepIds = new Set<string>();
    for (const step of parsed.data.steps) {
      if (stepIds.has(step.id)) {
        findings.push({
          id: `qa-duplicate-step-${parsed.data.id}-${step.id}`,
          severity: "error",
          code: "qa.duplicate_step_id",
          message: `Duplicate step id '${step.id}' in scenario '${parsed.data.id}'`,
          scenarioId: parsed.data.id,
          stepId: step.id,
        });
      }
      stepIds.add(step.id);

      if (step.type === "teleport" && !step.coords) {
        findings.push({
          id: `qa-teleport-no-coords-${parsed.data.id}-${step.id}`,
          severity: "error",
          code: "qa.teleport_missing_coords",
          message: `Teleport step '${step.id}' is missing coords`,
          scenarioId: parsed.data.id,
          stepId: step.id,
        });
      }
    }

    if (parsed.data.expectedResults.length === 0) {
      findings.push({
        id: `qa-no-expected-${parsed.data.id}`,
        severity: "warning",
        code: "qa.missing_expected_results",
        message: `Scenario '${parsed.data.id}' has no expectedResults`,
        scenarioId: parsed.data.id,
      });
    }
  }

  const errors = findings.filter((finding) => finding.severity === "error").length;
  const warnings = findings.filter((finding) => finding.severity === "warning").length;

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    workspaceName: options.workspaceName,
    workspaceRoot: options.workspaceRoot,
    summary: {
      scenariosChecked: registry.scenarios.length,
      errors,
      warnings,
    },
    findings,
  };
}
