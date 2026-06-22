import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { getAdapter } from "@fdt/adapters";
import {
  detectFrameworkProfile,
  listCraftingRecipes,
  listShops,
  loadContentRegistry,
  loadDomainModel,
  FDT_EXPORTS_DIR,
  FDT_REPORTS_DIR,
  toDomainModel,
} from "@fdt/core";
import { AdapterIdSchema, ContentValidationReportSchema } from "@fdt/schemas";
import { validateContent } from "@fdt/validators";
import { getGlobalOptions } from "../lib/global-options.js";
import { requireWorkspace } from "../lib/workspace.js";

export function registerContentCommands(program: Command): void {
  const content = program.command("content").description("Framework-agnostic content builders");

  content
    .command("validate")
    .description("Validate item registry (duplicate ids, missing icons)")
    .option("--icons-root <path>", "Directory containing item icon PNG files")
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      const iconsRoot = options.iconsRoot
        ? path.resolve(workspaceRoot, options.iconsRoot)
        : undefined;

      const report = await validateContent({
        workspaceRoot,
        workspaceName: workspace.name,
        iconsRoot,
      });

      const parsed = ContentValidationReportSchema.parse(report);
      const defaultOut = path.join(workspaceRoot, FDT_REPORTS_DIR, "content-validation.json");
      const outPath = globals.out ? path.resolve(workspaceRoot, globals.out) : defaultOut;

      await mkdir(path.dirname(outPath), { recursive: true });
      await writeFile(outPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");

      if (globals.ci) {
        console.log(
          JSON.stringify(
            {
              summary: parsed.summary,
              findingCount: parsed.findings.length,
              reportPath: outPath,
            },
            null,
            2,
          ),
        );
      } else {
        console.log(`Items checked: ${parsed.summary.itemsChecked}`);
        console.log(`Shops checked: ${parsed.summary.shopsChecked}`);
        console.log(`Recipes checked: ${parsed.summary.recipesChecked}`);
        console.log(`Errors: ${parsed.summary.errors}`);
        console.log(`Warnings: ${parsed.summary.warnings}`);
        for (const finding of parsed.findings) {
          const prefix =
            finding.severity === "error"
              ? "ERROR"
              : finding.severity === "warning"
                ? "WARN"
                : "INFO";
          const item = finding.itemId ? `[${finding.itemId}] ` : "";
          console.log(`${prefix} ${item}${finding.message}`);
        }
        console.log(`Report written to ${outPath}`);
      }

      if (parsed.summary.errors > 0) {
        process.exit(1);
      }
    });

  content
    .command("export")
    .description("Export items through a framework adapter")
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
      const frameworkProfile = await detectFrameworkProfile({ workspaceRoot, workspace });

      const registry = await loadContentRegistry(workspaceRoot);
      const model = options.adapter === "custom-json"
        ? await loadDomainModel(workspaceRoot)
        : toDomainModel(registry);
      const result = await adapter.export(model, {
        dryRun: options.dryRun,
        includeOxInventory:
          adapterId === "esx" && frameworkProfile.inventory === "ox-inventory",
      });

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
        console.log(`Wrote ${targetPath}`);
      }
    });

  const shops = content.command("shops").description("Manage neutral shop definitions");

  shops
    .command("list")
    .description("List shops in the workspace registry")
    .action(async (_options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot } = await requireWorkspace(globals);
      const shopsList = await listShops(workspaceRoot);

      if (globals.json) {
        console.log(JSON.stringify({ shops: shopsList }, null, 2));
      } else if (!globals.quiet) {
        for (const shop of shopsList) {
          console.log(`${shop.id} · ${shop.label} · ${shop.items.length} item(s)`);
        }
        console.log(`Total: ${shopsList.length}`);
      }
    });

  const crafting = content.command("crafting").description("Manage neutral crafting recipes");

  crafting
    .command("list")
    .description("List crafting recipes in the workspace registry")
    .action(async (_options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot } = await requireWorkspace(globals);
      const recipes = await listCraftingRecipes(workspaceRoot);

      if (globals.json) {
        console.log(JSON.stringify({ recipes }, null, 2));
      } else if (!globals.quiet) {
        for (const recipe of recipes) {
          console.log(`${recipe.id} · ${recipe.label} · ${recipe.inputs.length} input(s)`);
        }
        console.log(`Total: ${recipes.length}`);
      }
    });
}
