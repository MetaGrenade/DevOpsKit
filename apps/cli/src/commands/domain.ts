import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { getAdapter } from "@fdt/adapters";
import {
  createBusinessFromZone,
  createGangFromZone,
  createJobFromZone,
  createMapPackage,
  detectFrameworkProfile,
  loadDomainModel,
  refreshMapChecklist,
  FDT_EXPORTS_DIR,
  upsertJob,
  upsertVehicle,
} from "@fdt/core";
import { AdapterIdSchema, JobSchema, VehicleSchema } from "@fdt/schemas";
import { getGlobalOptions } from "../lib/global-options.js";
import { requireWorkspace } from "../lib/workspace.js";

export function registerDomainCommand(program: Command): void {
  const domain = program.command("domain").description("Domain builders for vehicles, businesses, jobs, gangs, and maps");

  domain
    .command("export")
    .description("Export vehicles, businesses, jobs, gangs, maps, and items through an adapter")
    .requiredOption(
      "--adapter <id>",
      "Adapter id (custom-json, qbcore, qbox, esx, ox-inventory)",
    )
    .option("--dry-run", "Preview export without writing files", false)
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);
      const adapterId = AdapterIdSchema.parse(options.adapter);
      const adapter = getAdapter(adapterId);
      await detectFrameworkProfile({ workspaceRoot, workspace });

      const model = await loadDomainModel(workspaceRoot);
      const result = await adapter.export(model, { dryRun: options.dryRun });

      const exportRoot = globals.out
        ? path.resolve(workspaceRoot, globals.out)
        : path.join(workspaceRoot, FDT_EXPORTS_DIR, adapterId);

      if (options.dryRun) {
        console.log(`Dry run — ${result.files.length} file(s) would be written to ${exportRoot}`);
        for (const file of result.files) {
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

  const vehicle = domain.command("vehicle").description("Vehicle registry commands");

  vehicle
    .command("add")
    .description("Add or update a vehicle in the workspace registry")
    .requiredOption("--spawn-name <name>", "Vehicle spawn name")
    .requiredOption("--display-name <name>", "Display label")
    .option("--category <category>", "Vehicle category", "car")
    .option("--price <price>", "Shop price")
    .option("--shop <shop>", "Shop id")
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot } = await requireWorkspace(globals);

      const vehicleRecord = VehicleSchema.parse({
        spawnName: options.spawnName,
        displayName: options.displayName,
        category: options.category,
        price: options.price ? Number(options.price) : undefined,
        shop: options.shop,
        metadata: {},
      });

      await upsertVehicle(workspaceRoot, vehicleRecord);
      if (!globals.quiet) {
        console.log(`Saved vehicle ${vehicleRecord.spawnName}`);
      }
    });

  const business = domain.command("business").description("Business builder commands");

  business
    .command("from-zone")
    .description("Create a business record from an exported devtools zone")
    .requiredOption("--zone-id <id>", "Zone id from .fdt/zones/zones.json")
    .option("--id <id>", "Business id override")
    .option("--label <label>", "Business label override")
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot } = await requireWorkspace(globals);

      try {
        const created = await createBusinessFromZone(workspaceRoot, {
          zoneId: options.zoneId,
          id: options.id,
          label: options.label,
        });

        if (globals.json) {
          console.log(JSON.stringify(created, null, 2));
        } else if (!globals.quiet) {
          console.log(`Created business ${created.id} from zone ${options.zoneId}`);
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  const job = domain.command("job").description("Job builder commands");

  job
    .command("add")
    .description("Add or update a job in the workspace registry")
    .requiredOption("--id <id>", "Job id")
    .requiredOption("--label <label>", "Job label")
    .option("--type <type>", "Job type", "custom")
    .option("--default-duty", "Mark job as default duty", false)
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot } = await requireWorkspace(globals);

      const jobRecord = JobSchema.parse({
        id: options.id,
        label: options.label,
        type: options.type,
        defaultDuty: Boolean(options.defaultDuty),
        grades: [{ id: "grade_0", level: 0, label: "Employee", payment: 0 }],
        locations: [],
        metadata: {},
      });

      await upsertJob(workspaceRoot, jobRecord);
      if (!globals.quiet) {
        console.log(`Saved job ${jobRecord.id}`);
      }
    });

  job
    .command("from-zone")
    .description("Create a job record from an exported devtools zone")
    .requiredOption("--zone-id <id>", "Zone id from .fdt/zones/zones.json")
    .option("--id <id>", "Job id override")
    .option("--label <label>", "Job label override")
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot } = await requireWorkspace(globals);

      try {
        const created = await createJobFromZone(workspaceRoot, {
          zoneId: options.zoneId,
          id: options.id,
          label: options.label,
        });

        if (globals.json) {
          console.log(JSON.stringify(created, null, 2));
        } else if (!globals.quiet) {
          console.log(`Created job ${created.id} from zone ${options.zoneId}`);
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  const gang = domain.command("gang").description("Gang / organization builder commands");

  gang
    .command("from-zone")
    .description("Create a gang or territory record from an exported devtools zone")
    .requiredOption("--zone-id <id>", "Zone id from .fdt/zones/zones.json")
    .option("--id <id>", "Gang id override")
    .option("--label <label>", "Gang label override")
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot } = await requireWorkspace(globals);

      try {
        const created = await createGangFromZone(workspaceRoot, {
          zoneId: options.zoneId,
          id: options.id,
          label: options.label,
        });

        if (globals.json) {
          console.log(JSON.stringify(created, null, 2));
        } else if (!globals.quiet) {
          console.log(`Created gang ${created.id} from zone ${options.zoneId}`);
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  const map = domain.command("map").description("Map / MLO package commands");

  map
    .command("new")
    .description("Create a map package with a default release checklist")
    .requiredOption("--id <id>", "Map package id")
    .requiredOption("--label <label>", "Map label")
    .requiredOption("--resource <name>", "FiveM resource folder name")
    .option("--resource-path <path>", "Relative resource path inside workspace")
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot } = await requireWorkspace(globals);

      const created = await createMapPackage(workspaceRoot, {
        id: options.id,
        label: options.label,
        resourceName: options.resource,
        resourcePath: options.resourcePath,
      });

      if (globals.json) {
        console.log(JSON.stringify(created, null, 2));
      } else if (!globals.quiet) {
        console.log(`Created map package ${created.id} with ${created.checklist.length} checklist items`);
      }
    });

  map
    .command("checklist")
    .description("Refresh checklist pass/fail state for a map package")
    .requiredOption("--id <id>", "Map package id")
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot } = await requireWorkspace(globals);

      try {
        const updated = await refreshMapChecklist(workspaceRoot, options.id);
        if (globals.json) {
          console.log(JSON.stringify(updated, null, 2));
        } else if (!globals.quiet) {
          console.log(`Map ${updated.id} status: ${updated.status}`);
          for (const item of updated.checklist) {
            console.log(`- [${item.passed ? "x" : " "}] ${item.label}`);
          }
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
