import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import {
  loadEconomySimulationReport,
  renderEconomyMarkdown,
  FDT_ECONOMY_MARKDOWN,
  FDT_ECONOMY_SIMULATION_REPORT,
  runEconomySimulation,
  saveEconomySimulationReport,
} from "@fdt/core";
import { getGlobalOptions } from "../lib/global-options.js";
import { requireWorkspace } from "../lib/workspace.js";

export function registerEconomyCommand(program: Command): void {
  const economy = program.command("economy").description("Economy simulation and balance reports");

  economy
    .command("simulate")
    .description("Simulate income activities, sinks, and vehicle affordability")
    .option("--profile <name>", "Economy profile label (uses .fdt/content/economy-profile.json)")
    .option("--hours <hours>", "Hours to simulate", "4")
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);
      const hours = Number(options.hours);

      if (!Number.isFinite(hours) || hours <= 0) {
        console.error("hours must be a positive number");
        process.exit(2);
      }

      const report = await runEconomySimulation({
        workspaceRoot,
        workspaceName: workspace.name,
        hours,
      });

      const reportPath = await saveEconomySimulationReport(workspaceRoot, report);

      if (globals.json) {
        console.log(JSON.stringify(report, null, 2));
      } else if (globals.ci) {
        console.log(
          JSON.stringify(
            {
              summary: report.summary,
              reportPath,
              passed: report.summary.comparedActivities >= 3,
            },
            null,
            2,
          ),
        );
      } else if (!globals.quiet) {
        console.log(`Simulated ${report.summary.activityCount} activities over ${hours} hour(s)`);
        console.log(`Top earner net/hour: ${report.summary.topEarnerNetPerHour.toFixed(0)}`);
        console.log(`Median net/hour: ${report.summary.medianNetPerHour.toFixed(0)}`);
        console.log(`Inflation risk: ${report.summary.inflationRisk}`);
        console.log(`Report written to ${reportPath}`);
      }
    });

  economy
    .command("report")
    .description("Render economy simulation markdown report")
    .option("--format <format>", "Output format: markdown or json", "markdown")
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      let report = await loadEconomySimulationReport(workspaceRoot);
      if (!report) {
        report = await runEconomySimulation({
          workspaceRoot,
          workspaceName: workspace.name,
        });
        await saveEconomySimulationReport(workspaceRoot, report);
      }

      const markdown = renderEconomyMarkdown(report);
      const markdownPath = path.join(workspaceRoot, FDT_ECONOMY_MARKDOWN);
      await mkdir(path.dirname(markdownPath), { recursive: true });
      await writeFile(markdownPath, markdown, "utf8");

      if (globals.json || options.format === "json") {
        console.log(JSON.stringify({ report, markdownPath, reportPath: path.join(workspaceRoot, FDT_ECONOMY_SIMULATION_REPORT) }, null, 2));
      } else if (!globals.quiet) {
        console.log(`Economy report written to ${markdownPath}`);
      }
    });
}
