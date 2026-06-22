import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { loadQaScenarioRegistry, FDT_QA_VALIDATION_REPORT, FDT_REPORTS_DIR } from "@fdt/core";
import { QaValidationReportSchema } from "@fdt/schemas";
import { validateQaScenarios } from "@fdt/validators";
import { getGlobalOptions } from "../lib/global-options.js";
import { requireWorkspace } from "../lib/workspace.js";

export function registerQaCommand(program: Command): void {
  const qa = program.command("qa").description("QA scenario validation and exports");

  qa
    .command("validate")
    .description("Validate QA scenarios in the workspace registry")
    .action(async (_options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      try {
        const registry = await loadQaScenarioRegistry(workspaceRoot);
        const report = await validateQaScenarios({
          workspaceRoot,
          workspaceName: workspace.name,
          registry,
        });
        const parsed = QaValidationReportSchema.parse(report);

        const defaultOut = path.join(workspaceRoot, FDT_QA_VALIDATION_REPORT);
        const outPath = globals.out ? path.resolve(workspaceRoot, globals.out) : defaultOut;

        await mkdir(path.dirname(outPath), { recursive: true });
        await writeFile(outPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");

        if (globals.json) {
          console.log(JSON.stringify(parsed, null, 2));
        } else if (globals.ci) {
          console.log(
            JSON.stringify(
              {
                summary: parsed.summary,
                findingCount: parsed.findings.length,
                reportPath: outPath,
              },
              null,
              2,
            ),
          );
        } else if (!globals.quiet) {
          console.log(`Scenarios checked: ${parsed.summary.scenariosChecked}`);
          console.log(`Errors: ${parsed.summary.errors}`);
          console.log(`Warnings: ${parsed.summary.warnings}`);
          console.log(`Report written to ${outPath}`);
        }

        if (parsed.summary.errors > 0) {
          process.exit(1);
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(globals.ci ? 1 : 10);
      }
    });

  qa
    .command("export-scenarios")
    .description("Export workspace QA scenarios for fdt_devtools in-game runner")
    .option(
      "--out <path>",
      "Output path for scenarios JSON (default: resources/fdt_devtools/data/qa-scenarios.json)",
    )
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot } = await requireWorkspace(globals);

      try {
        const registry = await loadQaScenarioRegistry(workspaceRoot);
        const outPath = options.out
          ? path.resolve(options.out)
          : path.resolve(process.cwd(), "resources", "fdt_devtools", "data", "qa-scenarios.json");

        await mkdir(path.dirname(outPath), { recursive: true });
        await writeFile(outPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");

        if (globals.json) {
          console.log(JSON.stringify({ outPath, scenarioCount: registry.scenarios.length }, null, 2));
        } else if (!globals.quiet) {
          console.log(`Exported ${registry.scenarios.length} scenario(s) to ${outPath}`);
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(10);
      }
    });
}
