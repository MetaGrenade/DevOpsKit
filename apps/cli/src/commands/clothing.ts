import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { getAdapter } from "@fdt/adapters";
import {
  createClothingPack,
  isLikelyClothingResource,
  listClothingPacks,
  loadDomainModel,
  FDT_CLOTHING_CHANGELOG,
  FDT_CLOTHING_CONFLICTS_REPORT,
  FDT_EXPORTS_DIR,
  scanClothingPack,
  upsertClothingPack,
} from "@fdt/core";
import { AdapterIdSchema } from "@fdt/schemas";
import { renderClothingChangelog, validateClothingConflicts } from "@fdt/validators";
import { getGlobalOptions } from "../lib/global-options.js";
import { requireWorkspace } from "../lib/workspace.js";

export function registerClothingCommand(program: Command): void {
  const clothing = program.command("clothing").description("Clothing pack catalog, scan, and validation");

  clothing
    .command("pack-new")
    .description("Create a clothing pack registry entry")
    .requiredOption("--id <id>", "Pack id")
    .requiredOption("--label <label>", "Pack label")
    .requiredOption("--resource <name>", "FiveM resource folder name")
    .option("--resource-path <path>", "Relative resource path inside workspace")
    .option("--gender <gender>", "Gender scope: male, female, shared", "shared")
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot } = await requireWorkspace(globals);

      const pack = await createClothingPack(workspaceRoot, {
        id: options.id,
        label: options.label,
        resourceName: options.resource,
        resourcePath: options.resourcePath,
        genderScope: options.gender,
      });

      if (globals.json) {
        console.log(JSON.stringify(pack, null, 2));
      } else if (!globals.quiet) {
        console.log(`Created clothing pack ${pack.id}`);
      }
    });

  clothing
    .command("scan")
    .description("Scan clothing resource stream folders and index drawables/textures")
    .option("--pack <id>", "Scan a single pack id")
    .option("--resource <name>", "Scan all packs matching a resource name")
    .option("--discover", "Auto-create packs for clothing-like resources", false)
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot } = await requireWorkspace(globals);

      let packs = await listClothingPacks(workspaceRoot);

      if (options.discover) {
        const { loadWorkspaceConfig } = await import("@fdt/core");
        const discovery = await loadWorkspaceConfig({ workspaceRoot });
        if (discovery.status === "found") {
          const { discoverResourceNames } = await import("@fdt/core");
          const resourcesRoot = path.resolve(workspaceRoot, discovery.workspace.resourcesRoot);
          for (const resourceName of discoverResourceNames(resourcesRoot)) {
            if (!isLikelyClothingResource(resourceName)) {
              continue;
            }
            const existing = packs.find((pack) => pack.resourceName === resourceName);
            if (!existing) {
              const created = await createClothingPack(workspaceRoot, {
                id: `pack_${resourceName}`,
                label: resourceName,
                resourceName,
                resourcePath: path
                  .join(discovery.workspace.resourcesRoot, resourceName)
                  .replace(/\\/g, "/"),
              });
              packs.push(created);
            }
          }
        }
      }

      if (options.pack) {
        packs = packs.filter((pack) => pack.id === options.pack);
      }
      if (options.resource) {
        packs = packs.filter((pack) => pack.resourceName === options.resource);
      }

      if (packs.length === 0) {
        console.error("No clothing packs found to scan");
        process.exit(globals.ci ? 1 : 2);
      }

      const scanned = [];
      for (const pack of packs) {
        const result = await scanClothingPack({ workspaceRoot, pack });
        await upsertClothingPack(workspaceRoot, result.pack);
        scanned.push(result);
      }

      if (globals.json) {
        console.log(JSON.stringify(scanned, null, 2));
      } else if (globals.ci) {
        console.log(
          JSON.stringify(
            {
              packsScanned: scanned.length,
              drawablesIndexed: scanned.reduce((sum, item) => sum + item.pack.drawables.length, 0),
            },
            null,
            2,
          ),
        );
      } else if (!globals.quiet) {
        for (const result of scanned) {
          console.log(
            `Scanned ${result.pack.id}: ${result.scannedFiles} files, ${result.pack.drawables.length} drawables`,
          );
        }
      }
    });

  clothing
    .command("conflicts")
    .description("Detect duplicate drawable slots, missing textures, and metadata gaps")
    .action(async (_options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      const packs = await listClothingPacks(workspaceRoot);
      const report = validateClothingConflicts({
        workspaceName: workspace.name,
        workspaceRoot,
        packs,
      });

      const defaultOut = path.join(workspaceRoot, FDT_CLOTHING_CONFLICTS_REPORT);
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

  clothing
    .command("export")
    .description("Export clothing packs through an adapter")
    .requiredOption("--adapter <id>", "Adapter id (qbox, ox-appearance, custom-json, qbcore, esx)")
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

  clothing
    .command("changelog")
    .description("Render a clothing pack changelog markdown report")
    .option("--since <iso>", "Only include packs scanned since this ISO timestamp")
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot } = await requireWorkspace(globals);

      const packs = await listClothingPacks(workspaceRoot);
      const markdown = renderClothingChangelog(packs, { since: options.since });
      const defaultOut = path.join(workspaceRoot, FDT_CLOTHING_CHANGELOG);
      const outPath = globals.out ? path.resolve(workspaceRoot, globals.out) : defaultOut;

      await mkdir(path.dirname(outPath), { recursive: true });
      await writeFile(outPath, markdown, "utf8");

      if (globals.json) {
        console.log(JSON.stringify({ markdownPath: outPath, packCount: packs.length }, null, 2));
      } else if (!globals.quiet) {
        console.log(`Clothing changelog written to ${outPath}`);
      }
    });
}
