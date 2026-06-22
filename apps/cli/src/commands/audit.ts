import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { FDT_ASSET_AUDITOR_REPORT } from "@fdt/core";
import { AssetAuditorReportSchema } from "@fdt/schemas";
import { auditStreamAssets, renderAssetAuditorMarkdown } from "@fdt/validators";
import { getGlobalOptions } from "../lib/global-options.js";
import { requireWorkspace } from "../lib/workspace.js";

export function registerAuditCommand(program: Command): void {
  const audit = program.command("audit").description("Run asset and stream audits");

  audit
    .command("stream")
    .description("Audit streamed GTA assets (duplicates, size budgets)")
    .option("--max-resource-mb <mb>", "Max stream folder size per resource in MB", "250")
    .option("--max-ytd-mb <mb>", "Max YTD file/total size in MB", "16")
    .option("--max-file-mb <mb>", "Max single stream file size in MB")
    .option("--markdown", "Also write asset-auditor.md", false)
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      const budget = {
        maxResourceMb: Number(options.maxResourceMb),
        maxYtdMb: Number(options.maxYtdMb),
        ...(options.maxFileMb ? { maxFileMb: Number(options.maxFileMb) } : {}),
      };

      try {
        const report = await auditStreamAssets({
          workspaceRoot,
          workspace,
          budget,
        });
        const parsed = AssetAuditorReportSchema.parse(report);

        const defaultOut = path.join(workspaceRoot, FDT_ASSET_AUDITOR_REPORT);
        const outPath = globals.out ? path.resolve(workspaceRoot, globals.out) : defaultOut;

        await mkdir(path.dirname(outPath), { recursive: true });
        await writeFile(outPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");

        if (options.markdown) {
          const mdPath = path.join(path.dirname(outPath), "asset-auditor.md");
          await writeFile(mdPath, renderAssetAuditorMarkdown(parsed), "utf8");
          if (!globals.quiet) {
            console.log(`Markdown report written to ${mdPath}`);
          }
        }

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
        } else if (globals.json) {
          console.log(JSON.stringify(parsed, null, 2));
        } else if (!globals.quiet) {
          console.log(`Assets indexed: ${parsed.summary.assetsIndexed}`);
          console.log(`Duplicate filenames: ${parsed.summary.duplicateFileNames}`);
          console.log(`Warnings: ${parsed.summary.warnings}`);
          console.log(`Report written to ${outPath}`);
        }

        if (parsed.summary.errors > 0) {
          process.exit(1);
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(10);
      }
    });
}
