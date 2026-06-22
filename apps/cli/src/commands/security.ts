import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Command } from "commander";
import {
  FDT_SECURITY_BASELINE,
  FDT_SECURITY_REPORT,
  FDT_SECURITY_SARIF,
} from "@fdt/core";
import { SecurityAuditReportSchema, SecurityBaselineSchema } from "@fdt/schemas";
import { renderSecuritySarif, scanSecurity } from "@fdt/validators";
import { getGlobalOptions } from "../lib/global-options.js";
import { requireWorkspace } from "../lib/workspace.js";

async function loadBaselineFingerprints(workspaceRoot: string): Promise<string[]> {
  const baselinePath = path.join(workspaceRoot, FDT_SECURITY_BASELINE);
  if (!existsSync(baselinePath)) {
    return [];
  }

  const baseline = SecurityBaselineSchema.parse(JSON.parse(await readFile(baselinePath, "utf8")));
  return baseline.findingFingerprints;
}

export function registerSecurityCommand(program: Command): void {
  const security = program.command("security").description("Scan Lua resources for risky patterns");

  security
    .command("scan")
    .description("Scan server resources for security anti-patterns")
    .option("--resource <name>", "Limit scan to one resource")
    .option("--format <format>", "Output format: json or sarif", "json")
    .option("--ignore-baseline", "Do not apply saved baseline suppressions", false)
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      try {
        const baselineFingerprints = options.ignoreBaseline
          ? []
          : await loadBaselineFingerprints(workspaceRoot);

        const report = await scanSecurity({
          workspaceRoot,
          workspace,
          resourceFilter: options.resource,
          baselineFingerprints,
        });
        const parsed = SecurityAuditReportSchema.parse(report);

        const defaultOut = path.join(workspaceRoot, FDT_SECURITY_REPORT);
        const outPath = globals.out ? path.resolve(workspaceRoot, globals.out) : defaultOut;

        await mkdir(path.dirname(outPath), { recursive: true });
        await writeFile(outPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");

        if (options.format === "sarif") {
          const sarifPath = path.join(path.dirname(outPath), path.basename(FDT_SECURITY_SARIF));
          await writeFile(sarifPath, renderSecuritySarif(parsed), "utf8");
          if (!globals.quiet) {
            console.log(`SARIF report written to ${sarifPath}`);
          }
        }

        if (globals.ci) {
          console.log(
            JSON.stringify(
              {
                summary: parsed.summary,
                reportPath: outPath,
                newCritical: parsed.summary.newCritical,
                newHigh: parsed.summary.newHigh,
              },
              null,
              2,
            ),
          );
        } else if (globals.json) {
          console.log(JSON.stringify(parsed, null, 2));
        } else if (!globals.quiet) {
          console.log(`Resources scanned: ${parsed.summary.resourcesScanned}`);
          console.log(`Lua files scanned: ${parsed.summary.luaFilesScanned}`);
          console.log(`Critical: ${parsed.summary.critical} (new: ${parsed.summary.newCritical})`);
          console.log(`High: ${parsed.summary.high} (new: ${parsed.summary.newHigh})`);
          console.log(`Suppressed by baseline: ${parsed.summary.suppressed}`);
          console.log(`Report written to ${outPath}`);
        }

        if (parsed.summary.newCritical > 0) {
          process.exit(1);
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(globals.ci ? 1 : 10);
      }
    });

  const baseline = security.command("baseline").description("Manage security finding baselines");

  baseline
    .command("create")
    .description("Create a baseline from the latest security audit report")
    .action(async (_options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      const reportPath = path.join(workspaceRoot, FDT_SECURITY_REPORT);
      if (!existsSync(reportPath)) {
        console.error(`No security report found at ${FDT_SECURITY_REPORT}. Run fdt security scan first.`);
        process.exit(2);
      }

      const report = SecurityAuditReportSchema.parse(JSON.parse(await readFile(reportPath, "utf8")));
      const baselinePayload = SecurityBaselineSchema.parse({
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        workspaceName: workspace.name,
        findingFingerprints: report.findings.map((finding) => finding.fingerprint),
      });

      const baselinePath = path.join(workspaceRoot, FDT_SECURITY_BASELINE);
      await mkdir(path.dirname(baselinePath), { recursive: true });
      await writeFile(baselinePath, `${JSON.stringify(baselinePayload, null, 2)}\n`, "utf8");

      if (globals.json) {
        console.log(JSON.stringify(baselinePayload, null, 2));
      } else if (!globals.quiet) {
        console.log(`Security baseline created with ${baselinePayload.findingFingerprints.length} fingerprints`);
        console.log(`Baseline written to ${baselinePath}`);
      }
    });

  baseline
    .command("compare")
    .description("Scan and compare findings against the saved baseline")
    .option("--resource <name>", "Limit scan to one resource")
    .action(async (options, command) => {
      const globals = getGlobalOptions(command);
      const { workspaceRoot, workspace } = await requireWorkspace(globals);

      const baselineFingerprints = await loadBaselineFingerprints(workspaceRoot);
      if (baselineFingerprints.length === 0) {
        console.error(`No baseline found at ${FDT_SECURITY_BASELINE}. Run fdt security baseline create first.`);
        process.exit(2);
      }

      const report = await scanSecurity({
        workspaceRoot,
        workspace,
        resourceFilter: options.resource,
        baselineFingerprints,
      });

      if (globals.json) {
        console.log(JSON.stringify(report, null, 2));
      } else if (!globals.quiet) {
        console.log(`New findings: ${report.summary.newFindings}`);
        console.log(`New critical: ${report.summary.newCritical}`);
        console.log(`Suppressed: ${report.summary.suppressed}`);
        for (const finding of report.findings.filter((item) => item.isNew)) {
          console.log(`${finding.severity.toUpperCase()} [${finding.resource}] ${finding.message}`);
        }
      }

      if (report.summary.newCritical > 0) {
        process.exit(1);
      }
    });
}
