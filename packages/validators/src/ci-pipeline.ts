import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  loadQaScenarioRegistry,
  refreshClothingPacksForCi,
  FDT_CI_PIPELINE_REPORT,
  FDT_CLOTHING_CONFLICTS_REPORT,
  FDT_CONTENT_VALIDATION_REPORT,
  FDT_QA_VALIDATION_REPORT,
  FDT_RESOURCE_DOCTOR_REPORT,
  FDT_SECURITY_BASELINE,
  FDT_SECURITY_REPORT,
  FDT_SECURITY_SARIF,
  FDT_NUI_SCHEMA_REPORT,
  validateWorkspaceNuiSchemas,
} from "@fdt/core";
import {
  CiGateIdSchema,
  CiPipelineReportSchema,
  SecurityBaselineSchema,
  type CiGateId,
  type CiGateResult,
  type CiPipelineReport,
  type Workspace,
} from "@fdt/schemas";
import { validateContent } from "./content-doctor.js";
import { validateClothingConflicts } from "./clothing-validator.js";
import { validateQaScenarios } from "./qa-validator.js";
import { validateResources } from "./resource-doctor.js";
import { renderSecuritySarif, scanSecurity } from "./security-auditor.js";

const DEFAULT_GATES: CiGateId[] = ["validate", "security", "qa"];

export interface RunCiPipelineOptions {
  workspaceRoot: string;
  workspace: Workspace;
  gates?: CiGateId[];
  reportOnlyGates?: CiGateId[];
  failOnWarnings?: boolean;
}

async function loadBaselineFingerprints(workspaceRoot: string): Promise<string[]> {
  const baselinePath = path.join(workspaceRoot, FDT_SECURITY_BASELINE);
  if (!existsSync(baselinePath)) {
    return [];
  }

  const baseline = SecurityBaselineSchema.parse(JSON.parse(await readFile(baselinePath, "utf8")));
  return baseline.findingFingerprints;
}

function gateFailed(status: CiGateResult["status"], blocking: boolean): boolean {
  return blocking && status === "failed";
}

async function runValidateGate(
  workspaceRoot: string,
  workspace: Workspace,
  blocking: boolean,
  failOnWarnings: boolean,
): Promise<CiGateResult> {
  const report = await validateResources({ workspaceRoot, workspace });
  const reportPath = path.join(workspaceRoot, FDT_RESOURCE_DOCTOR_REPORT);
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const hasErrors = report.summary.errors > 0;
  const hasWarnings = report.summary.warnings > 0;
  let status: CiGateResult["status"] = "passed";

  if (hasErrors) {
    status = "failed";
  } else if (hasWarnings && failOnWarnings) {
    status = "failed";
  } else if (hasWarnings) {
    status = "warn";
  }

  return {
    id: "validate",
    status,
    blocking,
    reportPath,
    summary: {
      resourcesScanned: report.summary.resourcesScanned,
      errors: report.summary.errors,
      warnings: report.summary.warnings,
    },
    message: hasErrors
      ? `Resource validation failed with ${report.summary.errors} error(s)`
      : hasWarnings
        ? `Resource validation passed with ${report.summary.warnings} warning(s)`
        : "Resource validation passed",
  };
}

async function runSecurityGate(
  workspaceRoot: string,
  workspace: Workspace,
  blocking: boolean,
): Promise<CiGateResult> {
  const baselineFingerprints = await loadBaselineFingerprints(workspaceRoot);
  const report = await scanSecurity({
    workspaceRoot,
    workspace,
    baselineFingerprints,
  });

  const reportPath = path.join(workspaceRoot, FDT_SECURITY_REPORT);
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const sarifPath = path.join(workspaceRoot, FDT_SECURITY_SARIF);
  await writeFile(sarifPath, renderSecuritySarif(report), "utf8");

  const hasBaseline = baselineFingerprints.length > 0;
  const failed = hasBaseline ? report.summary.newCritical > 0 : report.summary.critical > 0;

  return {
    id: "security",
    status: failed ? "failed" : report.summary.high > 0 ? "warn" : "passed",
    blocking,
    reportPath,
    summary: {
      critical: report.summary.critical,
      high: report.summary.high,
      newCritical: report.summary.newCritical,
      newHigh: report.summary.newHigh,
      suppressed: report.summary.suppressed,
      hasBaseline,
      sarifPath,
    },
    message: failed
      ? hasBaseline
        ? `Security gate failed: ${report.summary.newCritical} new critical finding(s)`
        : `Security gate failed: ${report.summary.critical} critical finding(s)`
      : "Security gate passed",
  };
}

async function runQaGate(workspaceRoot: string, workspace: Workspace, blocking: boolean): Promise<CiGateResult> {
  const registry = await loadQaScenarioRegistry(workspaceRoot);
  const report = await validateQaScenarios({
    workspaceRoot,
    workspaceName: workspace.name,
    registry,
  });

  const reportPath = path.join(workspaceRoot, FDT_QA_VALIDATION_REPORT);
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const failed = report.summary.errors > 0;
  const warned = report.summary.warnings > 0;

  return {
    id: "qa",
    status: failed ? "failed" : warned ? "warn" : "passed",
    blocking,
    reportPath,
    summary: {
      scenariosChecked: report.summary.scenariosChecked,
      errors: report.summary.errors,
      warnings: report.summary.warnings,
    },
    message: failed
      ? `QA validation failed with ${report.summary.errors} error(s)`
      : warned
        ? `QA validation passed with ${report.summary.warnings} warning(s)`
        : "QA validation passed",
  };
}

async function runContentGate(
  workspaceRoot: string,
  workspace: Workspace,
  blocking: boolean,
): Promise<CiGateResult> {
  const report = await validateContent({
    workspaceRoot,
    workspaceName: workspace.name,
  });

  const reportPath = path.join(workspaceRoot, FDT_CONTENT_VALIDATION_REPORT);
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const failed = report.summary.errors > 0;
  const warned = report.summary.warnings > 0;

  return {
    id: "content",
    status: failed ? "failed" : warned ? "warn" : "passed",
    blocking,
    reportPath,
    summary: {
      itemsChecked: report.summary.itemsChecked,
      errors: report.summary.errors,
      warnings: report.summary.warnings,
    },
    message: failed
      ? `Content validation failed with ${report.summary.errors} error(s)`
      : warned
        ? `Content validation passed with ${report.summary.warnings} warning(s)`
        : "Content validation passed",
  };
}

async function runClothingGate(
  workspaceRoot: string,
  workspace: Workspace,
  blocking: boolean,
): Promise<CiGateResult> {
  const packs = await refreshClothingPacksForCi({
    workspaceRoot,
    workspace,
    discover: true,
  });

  if (packs.length === 0) {
    return {
      id: "clothing",
      status: "skipped",
      blocking,
      summary: { packsChecked: 0, drawablesChecked: 0 },
      message: "No clothing packs found (discovered resources or registry entries)",
    };
  }

  const report = validateClothingConflicts({
    workspaceName: workspace.name,
    workspaceRoot,
    packs,
  });

  const reportPath = path.join(workspaceRoot, FDT_CLOTHING_CONFLICTS_REPORT);
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const failed = report.summary.errors > 0;
  const warned = report.summary.warnings > 0;

  return {
    id: "clothing",
    status: failed ? "failed" : warned ? "warn" : "passed",
    blocking,
    reportPath,
    summary: {
      packsChecked: report.summary.packsChecked,
      drawablesChecked: report.summary.drawablesChecked,
      errors: report.summary.errors,
      warnings: report.summary.warnings,
      discovered: packs.length,
    },
    message: failed
      ? `Clothing validation failed with ${report.summary.errors} error(s)`
      : warned
        ? `Clothing validation passed with ${report.summary.warnings} warning(s)`
        : "Clothing validation passed",
  };
}

async function runNuiGate(
  workspaceRoot: string,
  workspace: Workspace,
  blocking: boolean,
): Promise<CiGateResult> {
  const report = await validateWorkspaceNuiSchemas({
    workspaceName: workspace.name,
    workspaceRoot,
    resourcesRoot: workspace.resourcesRoot,
  });

  const reportPath = path.join(workspaceRoot, FDT_NUI_SCHEMA_REPORT);
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const failed = report.summary.errors > 0;
  const skipped = report.summary.resourcesChecked === 0;

  return {
    id: "nui",
    status: skipped ? "skipped" : failed ? "failed" : "passed",
    blocking,
    reportPath,
    summary: {
      resourcesChecked: report.summary.resourcesChecked,
      synced: report.summary.synced,
      errors: report.summary.errors,
      warnings: report.summary.warnings,
    },
    message: skipped
      ? "No NUI resources found (gate skipped)"
      : failed
        ? `NUI schema sync failed with ${report.summary.errors} error(s)`
        : "NUI schema sync passed",
  };
}

export async function runCiPipeline(options: RunCiPipelineOptions): Promise<CiPipelineReport> {
  const gates = (options.gates ?? DEFAULT_GATES).map((gate) => CiGateIdSchema.parse(gate));
  const reportOnly = new Set(options.reportOnlyGates ?? []);
  const results: CiGateResult[] = [];

  for (const gate of gates) {
    const blocking = !reportOnly.has(gate);

    if (gate === "validate") {
      results.push(
        await runValidateGate(options.workspaceRoot, options.workspace, blocking, Boolean(options.failOnWarnings)),
      );
      continue;
    }

    if (gate === "security") {
      results.push(await runSecurityGate(options.workspaceRoot, options.workspace, blocking));
      continue;
    }

    if (gate === "qa") {
      results.push(await runQaGate(options.workspaceRoot, options.workspace, blocking));
      continue;
    }

    if (gate === "content") {
      results.push(await runContentGate(options.workspaceRoot, options.workspace, blocking));
      continue;
    }

    if (gate === "clothing") {
      results.push(await runClothingGate(options.workspaceRoot, options.workspace, blocking));
      continue;
    }

    if (gate === "nui") {
      results.push(await runNuiGate(options.workspaceRoot, options.workspace, blocking));
    }
  }

  const passed = !results.some((result) => gateFailed(result.status, result.blocking));

  return CiPipelineReportSchema.parse({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    workspaceName: options.workspace.name,
    workspaceRoot: options.workspaceRoot,
    passed,
    gates: results,
  });
}

export async function writeCiPipelineReport(
  workspaceRoot: string,
  report: CiPipelineReport,
): Promise<string> {
  const reportPath = path.join(workspaceRoot, FDT_CI_PIPELINE_REPORT);
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

export function renderGithubActionsWorkflow(options?: {
  workspacePath?: string;
  gates?: CiGateId[];
  reportOnlyGates?: CiGateId[];
}): string {
  const workspacePath = options?.workspacePath ?? "./";
  const gates = (options?.gates ?? DEFAULT_GATES).join(",");
  const reportOnly = (options?.reportOnlyGates ?? ["validate"]).join(",");

  return `# Generated by fdt ci template
name: FDT Workspace CI

on:
  pull_request:
  push:
    branches: [main, develop]

permissions:
  contents: read
  security-events: write

jobs:
  fdt:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm build

      - name: Run FDT CI pipeline
        run: >
          pnpm fdt ci run
          --workspace ${workspacePath}
          --ci
          --gates ${gates}
          --report-only ${reportOnly}

      - name: Upload CI pipeline report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: fdt-ci-pipeline
          path: ${workspacePath}/.fdt/reports/ci-pipeline.json

      - name: Upload SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: ${workspacePath}/.fdt/reports/security-audit.sarif.json
          category: fdt-security
`;
}
