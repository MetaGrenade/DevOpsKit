import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { FDT_REPORTS_DIR } from "@fdt/core";
import { ResourceDoctorReportSchema } from "@fdt/schemas";
import { validateResources } from "@fdt/validators";
import { getGlobalOptions } from "../lib/global-options.js";
import { requireWorkspace } from "../lib/workspace.js";

function printCiSummary(
  report: ReturnType<typeof ResourceDoctorReportSchema.parse>,
  reportPath: string,
): void {
  console.log(
    JSON.stringify(
      {
        summary: report.summary,
        findingCount: report.findings.length,
        errorCodes: [...new Set(report.findings.filter((f) => f.severity === "error").map((f) => f.code))],
        reportPath,
      },
      null,
      2,
    ),
  );
}

function printHumanSummary(report: ReturnType<typeof ResourceDoctorReportSchema.parse>): void {
  console.log(`Resources scanned: ${report.summary.resourcesScanned}`);
  console.log(`Errors: ${report.summary.errors}`);
  console.log(`Warnings: ${report.summary.warnings}`);

  for (const finding of report.findings) {
    const prefix =
      finding.severity === "error" ? "ERROR" : finding.severity === "warning" ? "WARN" : "INFO";
    const location = finding.resource ? `[${finding.resource}] ` : "";
    console.log(`${prefix} ${location}${finding.message}`);
  }
}

export function registerValidateCommand(program: Command): void {
  const validate = program
    .command("validate")
    .description("Validate resources, manifests, and configs");

  validate
    .command("resources")
    .description("Validate all resources in the workspace")
    .action(async (_options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      try {
        const report = await validateResources({ workspaceRoot, workspace });
        const parsed = ResourceDoctorReportSchema.parse(report);

        const defaultOut = path.join(workspaceRoot, FDT_REPORTS_DIR, "resource-doctor.json");
        const outPath = globals.out ? path.resolve(workspaceRoot, globals.out) : defaultOut;

        await mkdir(path.dirname(outPath), { recursive: true });
        await writeFile(outPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");

        if (globals.json) {
          console.log(JSON.stringify(parsed, null, 2));
        } else if (globals.ci) {
          printCiSummary(parsed, outPath);
        } else if (!globals.quiet) {
          printHumanSummary(parsed);
          console.log(`Report written to ${outPath}`);
        }

        const failOnWarnings = globals.failOnWarnings ?? false;
        const hasErrors = parsed.summary.errors > 0;
        const hasWarnings = parsed.summary.warnings > 0;

        if (hasErrors || (failOnWarnings && hasWarnings)) {
          process.exit(1);
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(globals.ci ? 1 : 10);
      }
    });

  validate
    .command("manifest")
    .argument("<path>", "Resource path to validate")
    .description("Validate a single resource manifest (planned)")
    .action(() => {
      console.error("Command not yet implemented: fdt validate manifest");
      process.exit(1);
    });
}
