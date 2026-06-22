import type { Command } from "commander";
import {
  buildReleaseChecklist,
  buildReleaseDiffReport,
  createRelease,
  exportReleaseBundle,
  renderReleaseChecklistMarkdown,
  renderReleaseDiffMarkdown,
  saveReleaseChecklistReport,
  saveReleaseDiffReport,
  updateReleaseStatus,
} from "@fdt/core";
import { ReleaseEnvironmentSchema, ReleaseStatusSchema } from "@fdt/schemas";
import { getGlobalOptions } from "../lib/global-options.js";
import { requireWorkspace } from "../lib/workspace.js";

export function registerReleaseCommand(program: Command): void {
  const release = program
    .command("release")
    .description("Release candidates, changelogs, bundles, diffs, and checklists");

  release
    .command("create")
    .description("Create a release candidate from current validation reports")
    .requiredOption("--version <version>", "Release version (e.g. 0.4.0)")
    .option(
      "--environment <environment>",
      "Target environment: local, dev, staging, production",
      "dev",
    )
    .option("--created-by <name>", "Author or operator name")
    .option("--allow-validation-errors", "Allow release creation when validation has errors", false)
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      const environment = ReleaseEnvironmentSchema.safeParse(options.environment);
      if (!environment.success) {
        console.error("environment must be one of: local, dev, staging, production");
        process.exit(2);
      }

      try {
        const created = await createRelease({
          workspaceRoot,
          workspace,
          input: {
            version: options.version,
            targetEnvironment: environment.data,
            createdBy: options.createdBy,
            allowValidationErrors: Boolean(options.allowValidationErrors),
          },
        });

        if (globals.json) {
          console.log(JSON.stringify(created, null, 2));
        } else if (!globals.quiet) {
          console.log(`Release ${created.version} created (${created.status})`);
          console.log(`Bundle: ${created.bundlePath}`);
          console.log(`Changed resources: ${created.changedResources.length}`);
          console.log(`Changed content: ${created.changedContent.length}`);
          console.log(`Changed zones: ${created.changedZones.length}`);
          console.log(`Changed assets: ${created.changedAssets.length}`);
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(globals.ci ? 1 : 10);
      }
    });

  release
    .command("mark")
    .description("Update release status (qa-ready, qa-approved, deployed, etc.)")
    .requiredOption("--version <version>", "Release version or id")
    .requiredOption("--status <status>", "New status")
    .option("--changed-by <name>", "Operator name")
    .option("--note <note>", "Optional status note")
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot } = await requireWorkspace(globals);

      const status = ReleaseStatusSchema.safeParse(options.status);
      if (!status.success) {
        console.error(
          "status must be one of: draft, validated, qa-ready, qa-approved, deployed, rolled-back",
        );
        process.exit(2);
      }

      try {
        const updated = await updateReleaseStatus(workspaceRoot, options.version, {
          status: status.data,
          changedBy: options.changedBy,
          note: options.note,
        });

        if (globals.json) {
          console.log(JSON.stringify(updated, null, 2));
        } else if (!globals.quiet) {
          console.log(`Release ${updated.version} marked as ${updated.status}`);
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(globals.ci ? 1 : 10);
      }
    });

  release
    .command("diff")
    .description("Compare two release versions and write a diff report")
    .requiredOption("--from <version>", "Earlier release version")
    .requiredOption("--to <version>", "Later release version")
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot } = await requireWorkspace(globals);

      try {
        const report = await buildReleaseDiffReport(workspaceRoot, options.from, options.to);
        const reportPath = await saveReleaseDiffReport(workspaceRoot, report);
        const markdown = renderReleaseDiffMarkdown(report);

        if (globals.json) {
          console.log(JSON.stringify({ report, reportPath, markdown }, null, 2));
        } else if (!globals.quiet) {
          console.log(`Release diff ${report.fromVersion} → ${report.toVersion}`);
          console.log(`Report: ${reportPath}`);
          console.log("");
          console.log(markdown);
        }

        if (globals.ci && report.validation.to.errors > report.validation.from.errors) {
          process.exit(1);
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(globals.ci ? 1 : 10);
      }
    });

  release
    .command("checklist")
    .description("Build a QA/deploy checklist for a release version")
    .requiredOption("--version <version>", "Release version or id")
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot } = await requireWorkspace(globals);

      try {
        const report = await buildReleaseChecklist(workspaceRoot, options.version);
        const reportPath = await saveReleaseChecklistReport(workspaceRoot, report);
        const markdown = renderReleaseChecklistMarkdown(report);

        if (globals.json) {
          console.log(JSON.stringify({ report, reportPath, markdown }, null, 2));
        } else if (!globals.quiet) {
          console.log(`Release checklist ${report.releaseVersion}: ${report.passed ? "passed" : "failed"}`);
          console.log(`Report: ${reportPath}`);
          console.log("");
          console.log(markdown);
        }

        if (globals.ci && !report.passed) {
          process.exit(1);
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(globals.ci ? 1 : 10);
      }
    });

  release
    .command("bundle")
    .description("Export a release bundle to a custom output directory")
    .requiredOption("--version <version>", "Release version or id")
    .option("--out <path>", "Output directory relative to workspace")
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot } = await requireWorkspace(globals);

      const outputDir = options.out ?? `.fdt/exports/releases/${options.version}`;

      try {
        const result = await exportReleaseBundle({
          workspaceRoot,
          releaseVersion: options.version,
          outputDir,
        });

        if (globals.json) {
          console.log(JSON.stringify(result, null, 2));
        } else if (!globals.quiet) {
          console.log(`Release bundle exported to ${result.outputDir}`);
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(globals.ci ? 1 : 10);
      }
    });
}
