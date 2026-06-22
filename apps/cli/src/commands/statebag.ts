import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { importStateBagExport, listStateBagSnapshots } from "@fdt/core";
import { StateBagExportSchema } from "@fdt/schemas";
import { getGlobalOptions } from "../lib/global-options.js";
import { requireWorkspace } from "../lib/workspace.js";

export function registerStateBagCommand(program: Command): void {
  const statebag = program.command("statebag").description("State bag debug snapshot tools");

  statebag
    .command("list")
    .description("List imported state bag snapshots in the workspace")
    .action(async (_options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot } = await requireWorkspace(globals);
      const snapshots = await listStateBagSnapshots(workspaceRoot);

      if (globals.json) {
        console.log(JSON.stringify(snapshots, null, 2));
      } else if (!globals.quiet) {
        for (const snapshot of snapshots) {
          console.log(`${snapshot.target.bagName} · ${snapshot.target.kind} · ${snapshot.entries.length} entries`);
        }
      }
    });

  statebag
    .command("import")
    .description("Import a state bag export JSON file from fdt_devtools")
    .argument("<file>", "Path to state bag export JSON")
    .action(async (file: string, _options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot } = await requireWorkspace(globals);

      const filePath = path.resolve(workspaceRoot, file);
      const raw = JSON.parse(await readFile(filePath, "utf8"));
      const payload = StateBagExportSchema.parse(raw);
      const result = await importStateBagExport(workspaceRoot, payload);

      if (globals.json) {
        console.log(JSON.stringify(result, null, 2));
      } else if (!globals.quiet) {
        console.log(`Imported ${result.imported} snapshot(s)`);
      }
    });
}
