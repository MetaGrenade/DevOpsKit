import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import {
  addNuiCallback,
  addNuiMessage,
  assertNuiResource,
  discoverNuiResources,
  resolveNuiResourceRoot,
  FDT_NUI_SCHEMA_REPORT,
  syncNuiBridgeSchemas,
  syncWorkspaceNuiSchemas,
  validateWorkspaceNuiSchemas,
  writeNuiResource,
} from "@fdt/core";
import { getGlobalOptions } from "../lib/global-options.js";
import { requireWorkspace } from "../lib/workspace.js";

function runCommand(cwd: string, command: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

export function registerNuiCommand(program: Command): void {
  const nui = program.command("nui").description("Scaffold and build FiveM NUI resources");

  nui
    .command("new")
    .description("Generate a React + Vite NUI resource with mock mode")
    .argument("<name>", "Resource folder name")
    .option("--label <label>", "Display title for the NUI")
    .option("--no-mock", "Disable browser mock mode in generated web app")
    .option("--force", "Overwrite generated starter files in an existing folder", false)
    .action(async (name: string, options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      try {
        const resourceRoot = await writeNuiResource({
          workspaceRoot,
          resourcesRoot: workspace.resourcesRoot,
          resourceName: name,
          title: options.label,
          mockMode: options.mock,
          force: options.force,
        });

        if (globals.json) {
          console.log(JSON.stringify({ resourceRoot, resourceName: name }, null, 2));
        } else if (!globals.quiet) {
          console.log(`Created NUI resource at ${resourceRoot}`);
          console.log(`Next: cd ${path.join(resourceRoot, "web")} && pnpm install && pnpm dev`);
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(globals.ci ? 1 : 2);
      }
    });

  nui
    .command("add-callback")
    .description("Add a RegisterNUICallback handler and matching TypeScript wrapper")
    .argument("<resource>", "Resource folder name")
    .argument("<name>", "Callback name (camelCase)")
    .action(async (resource: string, name: string, _options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);
      const resourceRoot = resolveNuiResourceRoot(workspaceRoot, workspace.resourcesRoot, resource);

      try {
        await assertNuiResource(resourceRoot);
        const registry = await addNuiCallback(resourceRoot, name);

        if (globals.json) {
          console.log(JSON.stringify(registry, null, 2));
        } else if (!globals.quiet) {
          console.log(`Added NUI callback ${name} to ${resource}`);
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(globals.ci ? 1 : 2);
      }
    });

  nui
    .command("add-message")
    .description("Add a SendNUIMessage action and matching TypeScript handler type")
    .argument("<resource>", "Resource folder name")
    .argument("<name>", "Message action name (camelCase)")
    .action(async (resource: string, name: string, _options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);
      const resourceRoot = resolveNuiResourceRoot(workspaceRoot, workspace.resourcesRoot, resource);

      try {
        await assertNuiResource(resourceRoot);
        const registry = await addNuiMessage(resourceRoot, name);

        if (globals.json) {
          console.log(JSON.stringify(registry, null, 2));
        } else if (!globals.quiet) {
          console.log(`Added NUI message ${name} to ${resource}`);
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(globals.ci ? 1 : 2);
      }
    });

  nui
    .command("sync")
    .description("Regenerate Lua and TypeScript bridge files from shared/nui-bridge.json")
    .argument("[resource]", "Resource folder name (sync all NUI resources when omitted)")
    .action(async (resource: string | undefined, _options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      if (resource) {
        const resourceRoot = resolveNuiResourceRoot(workspaceRoot, workspace.resourcesRoot, resource);
        await assertNuiResource(resourceRoot);
        const registry = await syncNuiBridgeSchemas(resourceRoot);
        if (globals.json) {
          console.log(JSON.stringify(registry, null, 2));
        } else if (!globals.quiet) {
          console.log(`Synced NUI schemas for ${resource}`);
        }
        return;
      }

      const synced = await syncWorkspaceNuiSchemas({
        workspaceRoot,
        resourcesRoot: workspace.resourcesRoot,
      });

      if (globals.json) {
        console.log(JSON.stringify({ synced: synced.map((entry) => entry.resourceName) }, null, 2));
      } else if (!globals.quiet) {
        console.log(`Synced ${synced.length} NUI resource(s)`);
      }
    });

  nui
    .command("validate")
    .description("Validate that Lua/TS bridge files match shared/nui-bridge.json")
    .action(async (_options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      const report = await validateWorkspaceNuiSchemas({
        workspaceName: workspace.name,
        workspaceRoot,
        resourcesRoot: workspace.resourcesRoot,
      });

      const outPath = path.join(workspaceRoot, FDT_NUI_SCHEMA_REPORT);
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
        console.log(`Checked ${report.summary.resourcesChecked} NUI resource(s)`);
        console.log(`Errors: ${report.summary.errors}`);
        console.log(`Report written to ${outPath}`);
      }

      if (report.summary.errors > 0) {
        process.exit(1);
      }
    });

  nui
    .command("scan")
    .description("List workspace resources with shared/nui-bridge.json")
    .action(async (_options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      const resources = await discoverNuiResources(workspaceRoot, workspace.resourcesRoot);
      if (globals.json) {
        console.log(JSON.stringify(resources, null, 2));
      } else if (!globals.quiet) {
        for (const resource of resources) {
          console.log(`${resource.resourceName} · ${resource.resourcePath}`);
        }
      }
    });

  nui
    .command("dev")
    .description("Run the Vite dev server for an NUI resource web app")
    .argument("<name>", "Resource folder name")
    .option("--install", "Run pnpm install in web/ before starting dev server", false)
    .action(async (name: string, options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);
      const webRoot = path.join(resolveNuiResourceRoot(workspaceRoot, workspace.resourcesRoot, name), "web");

      try {
        await access(webRoot);
      } catch {
        console.error(`NUI web folder not found: ${webRoot}`);
        process.exit(globals.ci ? 1 : 2);
      }

      try {
        if (options.install) {
          const installCode = await runCommand(webRoot, "pnpm", ["install"]);
          if (installCode !== 0) {
            process.exit(installCode);
          }
        }

        const devCode = await runCommand(webRoot, "pnpm", ["dev"]);
        process.exit(devCode);
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(globals.ci ? 1 : 10);
      }
    });

  nui
    .command("build")
    .description("Build the web/dist bundle for an NUI resource")
    .argument("<name>", "Resource folder name")
    .option("--install", "Run pnpm install in web/ before building", false)
    .action(async (name: string, options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      const resourceRoot = resolveNuiResourceRoot(workspaceRoot, workspace.resourcesRoot, name);
      const webRoot = path.join(resourceRoot, "web");

      try {
        await access(webRoot);
      } catch {
        console.error(`NUI web folder not found: ${webRoot}`);
        process.exit(globals.ci ? 1 : 2);
      }

      try {
        if (options.install) {
          const installCode = await runCommand(webRoot, "pnpm", ["install"]);
          if (installCode !== 0) {
            process.exit(installCode);
          }
        }

        const buildCode = await runCommand(webRoot, "pnpm", ["build"]);
        if (buildCode !== 0) {
          process.exit(buildCode);
        }

        if (globals.json) {
          console.log(JSON.stringify({ resourceRoot, dist: path.join(webRoot, "dist") }, null, 2));
        } else if (!globals.quiet) {
          console.log(`Built NUI dist for ${name} at ${path.join(webRoot, "dist")}`);
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(globals.ci ? 1 : 10);
      }
    });
}
