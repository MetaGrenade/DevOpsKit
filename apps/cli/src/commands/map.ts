import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import {
  createMapPackage,
  listMapPackages,
  refreshMapChecklist,
  deriveMapIdFromResourceName,
  FDT_MAP_AUDIT_REPORT,
  FDT_MAP_TEST_POINTS,
  scanWorkspaceMaps,
  syncMapRegistryFromScan,
  writeMapResource,
} from "@fdt/core";
import { validateMaps, renderMapTestPoints, renderWorkspaceMapTestPoints } from "@fdt/validators";
import { getGlobalOptions } from "../lib/global-options.js";
import { requireWorkspace } from "../lib/workspace.js";

export function registerMapCommand(program: Command): void {
  const map = program.command("map").description("Map/MLO packaging scaffold, audit, checklist, and QA exports");

  map
    .command("new")
    .description("Scaffold a new map resource and register it in the workspace")
    .argument("<resourceName>", "Resource folder name (e.g. meta_map_office)")
    .option("--label <label>", "Display label")
    .option("--id <id>", "Map registry id")
    .option("--force", "Overwrite scaffold files if the resource folder exists")
    .action(async (resourceName: string, options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      const resourceRoot = await writeMapResource({
        workspaceRoot,
        resourcesRoot: workspace.resourcesRoot,
        resourceName,
        label: options.label,
        mapId: options.id,
        force: options.force === true,
      });

      const mapId = options.id ?? deriveMapIdFromResourceName(resourceName);
      const label = options.label ?? resourceName.replace(/_/g, " ");
      const resourcePath = path.relative(workspaceRoot, resourceRoot).replace(/\\/g, "/");

      const mapPackage = await createMapPackage(workspaceRoot, {
        id: mapId,
        label,
        resourceName,
        resourcePath,
      });

      const scanned = await scanWorkspaceMaps({
        workspaceRoot,
        resourcesRoot: workspace.resourcesRoot,
        discover: false,
        resourceName,
      });
      const synced = scanned[0]
        ? await syncMapRegistryFromScan(workspaceRoot, scanned[0], mapId)
        : mapPackage;

      if (globals.json) {
        console.log(JSON.stringify({ resourceRoot, map: synced }, null, 2));
      } else if (!globals.quiet) {
        console.log(`Created map resource at ${resourceRoot}`);
        console.log(`Registered map ${synced.id} (${synced.status})`);
      }
    });

  map
    .command("scan")
    .description("Scan map resources for stream assets and data files")
    .option("--resource <name>", "Scan a single resource")
    .option("--no-discover", "Only include map-like resource names without broad asset discovery")
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      const scanned = await scanWorkspaceMaps({
        workspaceRoot,
        resourcesRoot: workspace.resourcesRoot,
        discover: options.discover !== false,
        resourceName: options.resource,
      });

      if (scanned.length === 0) {
        console.error("No map resources found to scan");
        process.exit(globals.ci ? 1 : 2);
      }

      if (globals.json) {
        console.log(JSON.stringify(scanned, null, 2));
      } else if (globals.ci) {
        console.log(
          JSON.stringify(
            {
              resourcesScanned: scanned.length,
              streamFiles: scanned.reduce((sum, item) => sum + item.streamFileCount, 0),
            },
            null,
            2,
          ),
        );
      } else if (!globals.quiet) {
        for (const result of scanned) {
          console.log(
            `Scanned ${result.resourceName}: ${result.streamFileCount} stream file(s), manifest=${result.hasManifest}`,
          );
        }
      }
    });

  map
    .command("audit")
    .description("Audit map resources for manifest, stream assets, and documentation gaps")
    .option("--resource <name>", "Audit a single resource")
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      const scanned = await scanWorkspaceMaps({
        workspaceRoot,
        resourcesRoot: workspace.resourcesRoot,
        discover: true,
        resourceName: options.resource,
      });

      for (const scan of scanned) {
        await syncMapRegistryFromScan(workspaceRoot, scan);
      }

      const maps = await listMapPackages(workspaceRoot);
      const report = validateMaps({
        workspaceName: workspace.name,
        workspaceRoot,
        maps,
        scanned,
      });

      const defaultOut = path.join(workspaceRoot, FDT_MAP_AUDIT_REPORT);
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

  map
    .command("checklist")
    .description("Refresh checklist status for a map package")
    .requiredOption("--id <id>", "Map registry id")
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      const maps = await listMapPackages(workspaceRoot);
      const current = maps.find((entry) => entry.id === options.id);
      if (!current) {
        console.error(`Map package not found: ${options.id}`);
        process.exit(1);
      }

      const scanned = await scanWorkspaceMaps({
        workspaceRoot,
        resourcesRoot: workspace.resourcesRoot,
        discover: false,
        resourceName: current.resourceName,
      });
      if (scanned[0]) {
        await syncMapRegistryFromScan(workspaceRoot, scanned[0], current.id);
      }

      const mapPackage = await refreshMapChecklist(workspaceRoot, options.id);

      if (globals.json) {
        console.log(JSON.stringify(mapPackage, null, 2));
      } else if (!globals.quiet) {
        const passed = mapPackage.checklist.filter((item) => item.passed).length;
        console.log(`Map ${mapPackage.id}: ${passed}/${mapPackage.checklist.length} checklist items passed (${mapPackage.status})`);
      }
    });

  map
    .command("export-test-points")
    .description("Export QA teleport test points for one or all map packages")
    .option("--id <id>", "Map registry id (exports all maps when omitted)")
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      const maps = await listMapPackages(workspaceRoot);
      const selected = options.id ? maps.filter((entry) => entry.id === options.id) : maps;

      if (selected.length === 0) {
        console.error(options.id ? `Map package not found: ${options.id}` : "No map packages registered");
        process.exit(1);
      }

      const workspaceExport = renderWorkspaceMapTestPoints(workspace.name, selected);
      const defaultOut = path.join(workspaceRoot, FDT_MAP_TEST_POINTS);
      const outPath = globals.out ? path.resolve(workspaceRoot, globals.out) : defaultOut;
      await mkdir(path.dirname(outPath), { recursive: true });
      await writeFile(outPath, `${JSON.stringify(workspaceExport, null, 2)}\n`, "utf8");

      for (const mapPackage of selected) {
        const exportPayload = renderMapTestPoints(mapPackage);
        const mapsList = await listMapPackages(workspaceRoot);
        const current = mapsList.find((entry) => entry.id === mapPackage.id);
        if (current?.resourcePath) {
          const dataPath = path.join(workspaceRoot, current.resourcePath, "data", "test_points.json");
          await mkdir(path.dirname(dataPath), { recursive: true });
          await writeFile(
            dataPath,
            `${JSON.stringify({ schemaVersion: 1, mapId: exportPayload.mapId, testPoints: exportPayload.testPoints }, null, 2)}\n`,
            "utf8",
          );
        }
      }

      if (globals.json) {
        console.log(JSON.stringify(workspaceExport, null, 2));
      } else if (!globals.quiet) {
        console.log(`Exported test points for ${selected.length} map(s) to ${outPath}`);
      }
    });
}
