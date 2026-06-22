import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Command } from "commander";
import {
  buildDependencyGraph,
  findGraphEvents,
  findImpactedResources,
  FDT_DEPENDENCY_GRAPH,
  renderDependencyGraphDot,
  renderDependencyGraphHtml,
} from "@fdt/core";
import { scanResources } from "@fdt/scanner";
import { getGlobalOptions } from "../lib/global-options.js";
import { requireWorkspace } from "../lib/workspace.js";

export function registerGraphCommand(program: Command): void {
  const graph = program.command("graph").description("Build and inspect workspace dependency graphs");

  graph
    .command("build")
    .description("Build a dependency graph from manifests, file references, and Lua events")
    .action(async (_options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      const scanResult = await scanResources({ workspaceRoot, workspace });
      const report = await buildDependencyGraph({
        workspaceName: workspace.name,
        workspaceRoot,
        scanResult,
      });

      const defaultOut = path.join(workspaceRoot, FDT_DEPENDENCY_GRAPH);
      const outPath = globals.out ? path.resolve(workspaceRoot, globals.out) : defaultOut;
      await mkdir(path.dirname(outPath), { recursive: true });
      await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

      if (globals.json) {
        console.log(JSON.stringify(report, null, 2));
      } else if (globals.ci) {
        console.log(
          JSON.stringify(
            {
              summary: report.summary,
              reportPath: outPath,
            },
            null,
            2,
          ),
        );
      } else if (!globals.quiet) {
        console.log(`Built dependency graph with ${report.summary.edges} edges`);
        console.log(`Report written to ${outPath}`);
      }
    });

  graph
    .command("export")
    .description("Export the saved dependency graph report")
    .option("--format <format>", "Export format: json, dot, html", "json")
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot } = await requireWorkspace(globals);
      const reportPath = path.join(workspaceRoot, FDT_DEPENDENCY_GRAPH);
      if (!existsSync(reportPath)) {
        console.error(`No dependency graph report found at ${reportPath}. Run fdt graph build first.`);
        process.exit(2);
      }

      const report = JSON.parse(await readFile(reportPath, "utf8"));
      const format = String(options.format).toLowerCase();

      let output = `${JSON.stringify(report, null, 2)}\n`;
      let extension = "json";

      if (format === "dot") {
        output = renderDependencyGraphDot(report);
        extension = "dot";
      } else if (format === "html") {
        output = renderDependencyGraphHtml(report);
        extension = "html";
      }

      const outPath = globals.out
        ? path.resolve(workspaceRoot, globals.out)
        : path.join(workspaceRoot, `.fdt/exports/dependency-graph.${extension}`);
      await mkdir(path.dirname(outPath), { recursive: true });
      await writeFile(outPath, output, "utf8");

      if (globals.json) {
        console.log(JSON.stringify({ format, outPath }, null, 2));
      } else if (!globals.quiet) {
        console.log(`Exported dependency graph (${format}) to ${outPath}`);
      }
    });

  graph
    .command("find-event")
    .description("Find resources that register or trigger an event")
    .argument("<eventName>", "Event name")
    .action(async (eventName: string, _options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      const scanResult = await scanResources({ workspaceRoot, workspace });
      const report = await buildDependencyGraph({
        workspaceName: workspace.name,
        workspaceRoot,
        scanResult,
      });
      const matches = findGraphEvents(report, eventName);

      if (globals.json) {
        console.log(JSON.stringify({ eventName, matches }, null, 2));
      } else if (!globals.quiet) {
        if (matches.length === 0) {
          console.log(`No graph edges found for event ${eventName}`);
        } else {
          for (const match of matches) {
            console.log(`${match.type} · ${match.resourceName ?? match.source} · ${match.details?.file ?? ""}`);
          }
        }
      }
    });

  graph
    .command("impacted")
    .description("List resources likely impacted when a resource changes")
    .requiredOption("--resource <name>", "Resource name")
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      const scanResult = await scanResources({ workspaceRoot, workspace });
      const report = await buildDependencyGraph({
        workspaceName: workspace.name,
        workspaceRoot,
        scanResult,
      });
      const impact = findImpactedResources(report, options.resource);

      if (globals.json) {
        console.log(JSON.stringify(impact, null, 2));
      } else if (!globals.quiet) {
        console.log(`Direct dependents: ${impact.directDependents.join(", ") || "(none)"}`);
        console.log(`Transitive dependents: ${impact.transitiveDependents.join(", ") || "(none)"}`);
      }
    });
}
