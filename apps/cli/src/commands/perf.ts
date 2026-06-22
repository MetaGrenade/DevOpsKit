import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import {
  comparePerformanceSnapshots,
  importPerformanceSnapshot,
  listPerformanceSnapshots,
  loadPerformanceComparisonReport,
  renderPerformanceMarkdown,
  resolvePerformanceSnapshotRef,
  FDT_PERFORMANCE_COMPARISON_REPORT,
  FDT_PERFORMANCE_MARKDOWN,
  savePerformanceComparisonReport,
} from "@fdt/core";
import { getGlobalOptions } from "../lib/global-options.js";
import { requireWorkspace } from "../lib/workspace.js";

export function registerPerfCommand(program: Command): void {
  const perf = program.command("perf").description("Performance snapshot import, compare, and reports");

  perf
    .command("import")
    .description("Import a performance snapshot JSON file into the workspace registry")
    .argument("<file>", "Path to snapshot JSON file")
    .option("--release-id <id>", "Attach snapshot to a release id")
    .option("--release-version <version>", "Attach snapshot to a release version")
    .option("--label <label>", "Override snapshot label")
    .action(async (file: string, options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot } = await requireWorkspace(globals);

      try {
        const filePath = path.resolve(workspaceRoot, file);
        const raw = await readFile(filePath, "utf8");
        const payload = JSON.parse(raw) as unknown;

        const snapshot = await importPerformanceSnapshot(workspaceRoot, payload, {
          releaseId: options.releaseId,
          releaseVersion: options.releaseVersion,
          label: options.label,
        });

        if (globals.json) {
          console.log(JSON.stringify(snapshot, null, 2));
        } else if (!globals.quiet) {
          console.log(`Imported performance snapshot ${snapshot.id}`);
          console.log(`Resources tracked: ${snapshot.resources.length}`);
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(globals.ci ? 1 : 10);
      }
    });

  perf
    .command("compare")
    .description("Compare two performance snapshots and write a regression report")
    .requiredOption("--from <ref>", "Baseline snapshot id, label, or release version")
    .requiredOption("--to <ref>", "Target snapshot id, label, or release version")
    .option("--threshold <percent>", "Regression threshold percent", "10")
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      try {
        const snapshots = await listPerformanceSnapshots(workspaceRoot);
        const baseline = resolvePerformanceSnapshotRef(snapshots, options.from);
        const target = resolvePerformanceSnapshotRef(snapshots, options.to);

        if (!baseline) {
          throw new Error(`Baseline snapshot not found: ${options.from}`);
        }
        if (!target) {
          throw new Error(`Target snapshot not found: ${options.to}`);
        }

        const report = comparePerformanceSnapshots({
          workspaceName: workspace.name,
          baseline,
          target,
          thresholdPercent: Number(options.threshold),
        });

        const defaultOut = path.join(workspaceRoot, FDT_PERFORMANCE_COMPARISON_REPORT);
        const outPath = globals.out ? path.resolve(workspaceRoot, globals.out) : defaultOut;
        await savePerformanceComparisonReport(workspaceRoot, report);

        if (globals.json) {
          console.log(JSON.stringify(report, null, 2));
        } else if (globals.ci) {
          console.log(
            JSON.stringify(
              {
                summary: report.summary,
                reportPath: outPath,
                passed: report.summary.regressions === 0,
              },
              null,
              2,
            ),
          );
        } else if (!globals.quiet) {
          console.log(`Compared ${baseline.id} -> ${target.id}`);
          console.log(`Regressions: ${report.summary.regressions}`);
          console.log(`Improvements: ${report.summary.improvements}`);
          console.log(`Report written to ${outPath}`);
        }

        if (report.summary.regressions > 0) {
          process.exit(1);
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(globals.ci ? 1 : 10);
      }
    });

  perf
    .command("report")
    .description("Render performance comparison markdown report")
    .option("--from <ref>", "Baseline snapshot ref (defaults to second-newest snapshot)")
    .option("--to <ref>", "Target snapshot ref (defaults to newest snapshot)")
    .option("--threshold <percent>", "Regression threshold percent", "10")
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      try {
        let report = await loadPerformanceComparisonReport(workspaceRoot);

        if (options.from || options.to) {
          const snapshots = await listPerformanceSnapshots(workspaceRoot);
          const baseline = resolvePerformanceSnapshotRef(
            snapshots,
            options.from ?? snapshots[1]?.id ?? "",
          );
          const target = resolvePerformanceSnapshotRef(
            snapshots,
            options.to ?? snapshots[0]?.id ?? "",
          );

          if (!baseline || !target) {
            throw new Error("Could not resolve baseline and target snapshots for comparison");
          }

          report = comparePerformanceSnapshots({
            workspaceName: workspace.name,
            baseline,
            target,
            thresholdPercent: Number(options.threshold),
          });
          await savePerformanceComparisonReport(workspaceRoot, report);
        } else if (!report) {
          const snapshots = await listPerformanceSnapshots(workspaceRoot);
          if (snapshots.length < 2) {
            throw new Error("Need at least two snapshots or an existing comparison report");
          }

          report = comparePerformanceSnapshots({
            workspaceName: workspace.name,
            baseline: snapshots[1]!,
            target: snapshots[0]!,
            thresholdPercent: Number(options.threshold),
          });
          await savePerformanceComparisonReport(workspaceRoot, report);
        }

        const markdown = renderPerformanceMarkdown(report);
        const defaultOut = path.join(workspaceRoot, FDT_PERFORMANCE_MARKDOWN);
        const outPath = globals.out ? path.resolve(workspaceRoot, globals.out) : defaultOut;

        await mkdir(path.dirname(outPath), { recursive: true });
        await writeFile(outPath, markdown, "utf8");

        if (globals.json) {
          console.log(JSON.stringify({ report, markdownPath: outPath }, null, 2));
        } else if (!globals.quiet) {
          console.log(`Performance report written to ${outPath}`);
          console.log(`Regressions: ${report.summary.regressions}`);
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(globals.ci ? 1 : 10);
      }
    });
}
