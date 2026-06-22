import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { FDT_ASSET_SCAN_REPORT, FDT_REPORTS_DIR } from "@fdt/core";
import { AssetScanReportSchema } from "@fdt/schemas";
import { scanResources, scanStreamAssets } from "@fdt/scanner";
import { getGlobalOptions } from "../lib/global-options.js";
import { requireWorkspace } from "../lib/workspace.js";

export function registerScanCommand(program: Command): void {
  const scan = program.command("scan").description("Scan server folders and build indexes");

  scan
    .command("resources")
    .description("Scan FiveM resources and build an inventory")
    .action(async (_options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      try {
        const result = await scanResources({ workspaceRoot, workspace });
        const payload = {
          schemaVersion: 1 as const,
          generatedAt: new Date().toISOString(),
          workspaceName: workspace.name,
          workspaceRoot,
          resourceCount: result.resources.length,
          resources: result.resources,
          serverCfg: {
            path: result.serverCfg.path,
            started: result.serverCfg.started,
            ensured: result.serverCfg.ensured,
          },
        };

        const defaultOut = path.join(workspaceRoot, FDT_REPORTS_DIR, "resource-scan.json");
        const outPath = globals.out ? path.resolve(workspaceRoot, globals.out) : defaultOut;

        await mkdir(path.dirname(outPath), { recursive: true });
        await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

        if (globals.json) {
          console.log(JSON.stringify(payload, null, 2));
        } else if (!globals.quiet) {
          console.log(`Scanned ${result.resources.length} resources`);
          console.log(`Report written to ${outPath}`);
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(3);
      }
    });

  scan
    .command("assets")
    .description("Index streamed GTA assets in resource stream folders")
    .action(async (_options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      try {
        const result = await scanStreamAssets({ workspaceRoot, workspace });
        const totalBytes = result.assets.reduce((sum, asset) => sum + asset.sizeBytes, 0);
        const payload = AssetScanReportSchema.parse({
          schemaVersion: 1,
          generatedAt: new Date().toISOString(),
          workspaceName: workspace.name,
          workspaceRoot,
          summary: {
            resourcesWithStream: result.resourceSummaries.length,
            assetsIndexed: result.assets.length,
            totalBytes,
          },
          assets: result.assets,
          resourceSummaries: result.resourceSummaries,
        });

        const defaultOut = path.join(workspaceRoot, FDT_ASSET_SCAN_REPORT);
        const outPath = globals.out ? path.resolve(workspaceRoot, globals.out) : defaultOut;

        await mkdir(path.dirname(outPath), { recursive: true });
        await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

        if (globals.json) {
          console.log(JSON.stringify(payload, null, 2));
        } else if (!globals.quiet) {
          console.log(`Indexed ${result.assets.length} stream assets`);
          console.log(`Report written to ${outPath}`);
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(3);
      }
    });
}
