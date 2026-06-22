import type { Command } from "commander";
import { listBlips, listDoors, listProps } from "@fdt/core";
import { getGlobalOptions } from "../lib/global-options.js";
import { requireWorkspace } from "../lib/workspace.js";

export function registerWorldCommand(program: Command): void {
  const world = program.command("world").description("Blips, props, and door placement records");

  world
    .command("list")
    .description("List imported world records from the workspace")
    .option("--type <type>", "Record type: blips, props, doors, or all", "all")
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot } = await requireWorkspace(globals);
      const type = String(options.type ?? "all");

      const [blips, props, doors] = await Promise.all([
        listBlips(workspaceRoot),
        listProps(workspaceRoot),
        listDoors(workspaceRoot),
      ]);

      if (globals.json) {
        const payload =
          type === "blips"
            ? { blips }
            : type === "props"
              ? { props }
              : type === "doors"
                ? { doors }
                : { blips, props, doors };
        console.log(JSON.stringify(payload, null, 2));
        return;
      }

      if (type === "all" || type === "blips") {
        if (!globals.quiet) console.log(`Blips (${blips.length})`);
        for (const blip of blips) {
          console.log(`  ${blip.id} · ${blip.label}`);
        }
      }

      if (type === "all" || type === "props") {
        if (!globals.quiet) console.log(`Props (${props.length})`);
        for (const prop of props) {
          console.log(`  ${prop.id} · ${prop.model}`);
        }
      }

      if (type === "all" || type === "doors") {
        if (!globals.quiet) console.log(`Doors (${doors.length})`);
        for (const door of doors) {
          console.log(`  ${door.id} · ${door.label}`);
        }
      }
    });
}
