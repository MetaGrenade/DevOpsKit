import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { getAdapter } from "@fdt/adapters";
import {
  compareHandlingMetrics,
  loadDomainModel,
  loadHandlingMetricsForSpawn,
  listVehicles,
  FDT_EXPORTS_DIR,
  FDT_VEHICLE_AUDIT_REPORT,
  FDT_VEHICLE_SPAWN_TESTS,
  scanWorkspaceVehicles,
} from "@fdt/core";
import { AdapterIdSchema, VehicleHandlingComparisonSchema } from "@fdt/schemas";
import { renderVehicleSpawnTests, validateVehicles } from "@fdt/validators";
import { getGlobalOptions } from "../lib/global-options.js";
import { requireWorkspace } from "../lib/workspace.js";

export function registerVehicleCommand(program: Command): void {
  const vehicle = program.command("vehicle").description("Vehicle pack scan, audit, handling compare, and export");

  vehicle
    .command("scan")
    .description("Scan vehicle resources for spawn names and meta files")
    .option("--resource <name>", "Scan a single resource")
    .option("--no-discover", "Only scan likely vehicle resource names")
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      const scanned = await scanWorkspaceVehicles({
        workspaceRoot,
        resourcesRoot: workspace.resourcesRoot,
        discover: options.discover !== false,
        resourceName: options.resource,
      });

      if (scanned.length === 0) {
        console.error("No vehicle resources found to scan");
        process.exit(globals.ci ? 1 : 2);
      }

      if (globals.json) {
        console.log(JSON.stringify(scanned, null, 2));
      } else if (globals.ci) {
        console.log(
          JSON.stringify(
            {
              resourcesScanned: scanned.length,
              vehiclesIndexed: scanned.reduce((sum, item) => sum + item.vehicles.length, 0),
            },
            null,
            2,
          ),
        );
      } else if (!globals.quiet) {
        for (const result of scanned) {
          console.log(
            `Scanned ${result.resourceName}: ${result.spawnNames.length} spawn name(s), ${result.files.yft.length} .yft file(s)`,
          );
        }
      }
    });

  vehicle
    .command("audit")
    .description("Detect duplicate spawn names, missing meta files, and stream model gaps")
    .action(async (_options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      const scanned = await scanWorkspaceVehicles({
        workspaceRoot,
        resourcesRoot: workspace.resourcesRoot,
        discover: true,
      });
      const vehicles = await listVehicles(workspaceRoot);
      const report = validateVehicles({
        workspaceName: workspace.name,
        workspaceRoot,
        vehicles,
        scanned: scanned.map((item) => ({
          resourceName: item.resourceName,
          spawnNames: item.spawnNames,
          files: item.files,
        })),
      });

      const defaultOut = path.join(workspaceRoot, FDT_VEHICLE_AUDIT_REPORT);
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
              passed: report.summary.errors === 0,
            },
            null,
            2,
          ),
        );
      } else if (!globals.quiet) {
        console.log(`Errors: ${report.summary.errors}`);
        console.log(`Warnings: ${report.summary.warnings}`);
        console.log(`Report written to ${outPath}`);
      }

      if (report.summary.errors > 0) {
        process.exit(1);
      }
    });

  vehicle
    .command("compare-handling")
    .description("Compare handling.meta metrics between two spawn names")
    .argument("<baseline>", "Baseline spawn name")
    .argument("<target>", "Target spawn name")
    .action(async (baseline: string, target: string, _options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      const baselineMetrics = await loadHandlingMetricsForSpawn(
        workspaceRoot,
        workspace.resourcesRoot,
        baseline.toLowerCase(),
      );
      const targetMetrics = await loadHandlingMetricsForSpawn(
        workspaceRoot,
        workspace.resourcesRoot,
        target.toLowerCase(),
      );

      if (!baselineMetrics || !targetMetrics) {
        console.error("Could not load handling.meta metrics for both spawn names");
        process.exit(globals.ci ? 1 : 2);
      }

      const { deltas, notes } = compareHandlingMetrics(baselineMetrics, targetMetrics);
      const comparison = VehicleHandlingComparisonSchema.parse({
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        baseline: baselineMetrics,
        target: targetMetrics,
        deltas,
        notes,
      });

      if (globals.json) {
        console.log(JSON.stringify(comparison, null, 2));
      } else if (!globals.quiet) {
        console.log(`Handling comparison: ${baseline} -> ${target}`);
        console.log(JSON.stringify(comparison.deltas, null, 2));
        for (const note of comparison.notes) {
          console.log(`- ${note}`);
        }
      }
    });

  vehicle
    .command("export")
    .description("Export vehicle shop entries through an adapter")
    .requiredOption("--adapter <id>", "Adapter id (qbox, custom-json, qbcore)")
    .option("--dry-run", "Preview export without writing files", false)
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot } = await requireWorkspace(globals);
      const adapterId = AdapterIdSchema.parse(options.adapter);
      const adapter = getAdapter(adapterId);
      const model = await loadDomainModel(workspaceRoot);
      const result = await adapter.export(model, { dryRun: options.dryRun });

      const exportRoot = globals.out
        ? path.resolve(workspaceRoot, globals.out)
        : path.join(workspaceRoot, FDT_EXPORTS_DIR, adapterId);

      if (options.dryRun) {
        console.log(`Dry run — ${result.files.length} file(s) would be written to ${exportRoot}`);
        for (const file of result.files.filter((entry) => entry.relativePath.includes("vehicle"))) {
          console.log(`\n--- ${file.relativePath} ---\n${file.content}`);
        }
        return;
      }

      for (const file of result.files) {
        const targetPath = path.join(exportRoot, file.relativePath);
        await mkdir(path.dirname(targetPath), { recursive: true });
        await writeFile(targetPath, file.content, "utf8");
        if (!globals.quiet) {
          console.log(`Wrote ${targetPath}`);
        }
      }
    });

  vehicle
    .command("test-list")
    .description("Generate QA spawn commands for registered vehicles")
    .action(async (_options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);
      const vehicles = await listVehicles(workspaceRoot);
      const tests = renderVehicleSpawnTests(workspace.name, vehicles);
      const defaultOut = path.join(workspaceRoot, FDT_VEHICLE_SPAWN_TESTS);
      const outPath = globals.out ? path.resolve(workspaceRoot, globals.out) : defaultOut;

      await mkdir(path.dirname(outPath), { recursive: true });
      await writeFile(outPath, `${JSON.stringify(tests, null, 2)}\n`, "utf8");

      if (globals.json) {
        console.log(JSON.stringify(tests, null, 2));
      } else if (!globals.quiet) {
        console.log(`Vehicle spawn test list written to ${outPath}`);
      }
    });
}
