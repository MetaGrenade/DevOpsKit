import path from "node:path";
import type { Command } from "commander";
import {
  buildEnvironmentDiffReport,
  generateServerCfg,
  generateTxAdminRecipe,
  initEnvironmentProfiles,
  listEnvironmentProfiles,
  loadEnvironmentRegistry,
  renderEnvironmentDiffMarkdown,
  resolveProfileForGeneration,
  saveEnvironmentDiffReport,
  saveEnvironmentValidationReport,
  validateEnvironmentProfile,
} from "@fdt/core";
import { getGlobalOptions } from "../lib/global-options.js";
import { requireWorkspace } from "../lib/workspace.js";

export function registerEnvCommand(program: Command): void {
  const env = program.command("env").description("Environment profiles, server.cfg, and txAdmin recipes");

  env
    .command("init")
    .description("Initialize default environment profiles (local, dev, staging, production)")
    .action(async (_options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      try {
        const registry = await initEnvironmentProfiles(workspaceRoot, workspace);

        if (globals.json) {
          console.log(JSON.stringify(registry, null, 2));
        } else if (!globals.quiet) {
          console.log(`Initialized ${registry.profiles.length} environment profiles`);
          console.log(`Default profile: ${registry.defaultProfileId}`);
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(globals.ci ? 1 : 10);
      }
    });

  env
    .command("list")
    .description("List environment profiles in the workspace")
    .action(async (_options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot } = await requireWorkspace(globals);

      const profiles = await listEnvironmentProfiles(workspaceRoot);
      const registry = await loadEnvironmentRegistry(workspaceRoot);

      if (globals.json) {
        console.log(JSON.stringify({ defaultProfileId: registry.defaultProfileId, profiles }, null, 2));
        return;
      }

      if (!globals.quiet) {
        console.log(`Environment profiles (${profiles.length})`);
      }
      for (const profile of profiles) {
        console.log(`  ${profile.id} · ${profile.label} (${profile.kind})`);
      }
    });

  env
    .command("generate-cfg")
    .description("Generate server.cfg for an environment profile")
    .option("--env <env>", "Profile id or kind (local, dev, staging, production)")
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      try {
        const profile = await resolveProfileForGeneration(workspaceRoot, options.env);
        const result = await generateServerCfg(workspaceRoot, workspace, profile);

        if (globals.json) {
          console.log(JSON.stringify(result, null, 2));
        } else if (!globals.quiet) {
          console.log(`Generated server.cfg for ${profile.id}`);
          console.log(`Resources ensured: ${result.ensureOrder.length}`);
          console.log(`Output: ${result.outputPath}`);
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(globals.ci ? 1 : 10);
      }
    });

  env
    .command("generate-recipe")
    .description("Generate a txAdmin-compatible YAML recipe scaffold")
    .option("--env <env>", "Profile id or kind (local, dev, staging, production)")
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      try {
        const profile = await resolveProfileForGeneration(workspaceRoot, options.env);
        const result = await generateTxAdminRecipe(workspaceRoot, workspace, profile);

        if (globals.json) {
          console.log(JSON.stringify(result, null, 2));
        } else if (!globals.quiet) {
          console.log(`Generated txAdmin recipe for ${profile.id}`);
          console.log(`Recipe: ${result.outputPath}`);
          console.log(`Server cfg: ${result.serverCfgPath}`);
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(globals.ci ? 1 : 10);
      }
    });

  env
    .command("validate")
    .description("Validate an environment profile (production secret checks)")
    .option("--env <env>", "Profile id or kind (defaults to production)")
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      try {
        const profile = await resolveProfileForGeneration(workspaceRoot, options.env ?? "production");
        const report = validateEnvironmentProfile(workspace.name, profile);
        const reportPath = await saveEnvironmentValidationReport(workspaceRoot, report);

        if (globals.json) {
          console.log(JSON.stringify({ report, reportPath }, null, 2));
        } else if (globals.ci) {
          console.log(
            JSON.stringify(
              {
                passed: report.passed,
                summary: report.summary,
                reportPath,
              },
              null,
              2,
            ),
          );
        } else if (!globals.quiet) {
          console.log(`Validated ${profile.id}: ${report.passed ? "passed" : "failed"}`);
          console.log(`Errors: ${report.summary.errors}, warnings: ${report.summary.warnings}`);
          console.log(`Report: ${reportPath}`);
        }

        if (!report.passed) {
          process.exit(1);
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(globals.ci ? 1 : 10);
      }
    });

  env
    .command("diff")
    .description("Diff two environment profiles")
    .requiredOption("--from <env>", "Source profile id or kind")
    .requiredOption("--to <env>", "Target profile id or kind")
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      try {
        const report = await buildEnvironmentDiffReport(
          workspaceRoot,
          workspace,
          options.from,
          options.to,
        );
        const reportPath = await saveEnvironmentDiffReport(workspaceRoot, report);
        const markdown = renderEnvironmentDiffMarkdown(report);

        if (globals.out) {
          const outPath = path.resolve(workspaceRoot, globals.out);
          const { writeFile, mkdir } = await import("node:fs/promises");
          await mkdir(path.dirname(outPath), { recursive: true });
          await writeFile(outPath, markdown, "utf8");
        }

        if (globals.json) {
          console.log(JSON.stringify({ report, reportPath }, null, 2));
        } else if (!globals.quiet) {
          console.log(`Diff ${report.fromProfileId} -> ${report.toProfileId}`);
          console.log(`Convar changes: ${report.summary.convarChanges}`);
          console.log(`Resource order changes: ${report.summary.resourceOrderChanges}`);
          console.log(`Report: ${reportPath}`);
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(globals.ci ? 1 : 10);
      }
    });
}
