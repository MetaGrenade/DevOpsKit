import type { Command } from "commander";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { CiGateIdSchema } from "@fdt/schemas";
import { renderGithubActionsWorkflow, runCiPipeline, writeCiPipelineReport } from "@fdt/validators";
import { getGlobalOptions } from "../lib/global-options.js";
import { requireWorkspace } from "../lib/workspace.js";

function parseGateList(value: string | undefined): Array<ReturnType<typeof CiGateIdSchema.parse>> {
  if (!value?.trim()) {
    return ["validate", "security", "qa"];
  }

  return value.split(",").map((gate) => CiGateIdSchema.parse(gate.trim()));
}

export function registerCiCommand(program: Command): void {
  const ci = program.command("ci").description("CI/CD pipeline orchestration");

  ci
    .command("run")
    .description("Run validation, security, and QA gates for CI")
    .option("--gates <gates>", "Comma-separated gates: validate,security,qa,content,clothing", "validate,security,qa")
    .option(
      "--report-only <gates>",
      "Run gates without failing the pipeline (comma-separated gate ids)",
      "validate",
    )
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      try {
        const report = await runCiPipeline({
          workspaceRoot,
          workspace,
          gates: parseGateList(options.gates),
          reportOnlyGates: parseGateList(options.reportOnly),
          failOnWarnings: globals.failOnWarnings,
        });

        const reportPath = await writeCiPipelineReport(workspaceRoot, report);

        if (globals.json) {
          console.log(JSON.stringify(report, null, 2));
        } else if (globals.ci) {
          console.log(
            JSON.stringify(
              {
                passed: report.passed,
                reportPath,
                gates: report.gates.map((gate) => ({
                  id: gate.id,
                  status: gate.status,
                  blocking: gate.blocking,
                  summary: gate.summary,
                })),
              },
              null,
              2,
            ),
          );
        } else if (!globals.quiet) {
          console.log(`CI pipeline ${report.passed ? "passed" : "failed"}`);
          for (const gate of report.gates) {
            console.log(`- ${gate.id}: ${gate.status}${gate.blocking ? "" : " (report-only)"}`);
            if (gate.message) {
              console.log(`  ${gate.message}`);
            }
          }
          console.log(`Report written to ${reportPath}`);
        }

        if (!report.passed) {
          process.exit(1);
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(globals.ci ? 1 : 10);
      }
    });

  ci
    .command("template")
    .description("Generate a GitHub Actions workflow for FDT CI")
    .option("--target <target>", "Template target (github)", "github")
    .option("--workspace <path>", "Workspace path inside the repo", "./")
    .option("--gates <gates>", "Comma-separated gates", "validate,security,qa")
    .option("--report-only <gates>", "Report-only gates", "validate")
    .option("--out <path>", "Write workflow to file instead of stdout")
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);

      if (options.target !== "github") {
        console.error("Only --target github is supported");
        process.exit(2);
      }

      const workflow = renderGithubActionsWorkflow({
        workspacePath: options.workspace,
        gates: parseGateList(options.gates),
        reportOnlyGates: parseGateList(options.reportOnly),
      });

      if (options.out) {
        const outPath = path.resolve(options.out);
        await mkdir(path.dirname(outPath), { recursive: true });
        await writeFile(outPath, workflow, "utf8");
        if (!globals.quiet) {
          console.log(`Workflow template written to ${outPath}`);
        }
        return;
      }

      process.stdout.write(workflow);
    });
}
