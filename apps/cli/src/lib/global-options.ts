import type { Command } from "commander";

export interface GlobalCliOptions {
  workspace?: string;
  config?: string;
  json?: boolean;
  out?: string;
  verbose?: boolean;
  quiet?: boolean;
  ci?: boolean;
  failOnWarnings?: boolean;
  env?: "local" | "dev" | "staging" | "production";
}

export function registerGlobalOptions(program: Command): void {
  program
    .option("--workspace <path>", "Workspace root directory")
    .option("--config <path>", "Path to fdt.workspace.json")
    .option("--json", "Emit machine-readable JSON output")
    .option("--out <path>", "Write report output to a file")
    .option("--verbose", "Enable verbose logging")
    .option("--quiet", "Suppress non-essential output")
    .option("--ci", "CI-friendly output and exit codes")
    .option("--fail-on-warnings", "Treat warnings as failures")
    .option("--env <environment>", "Target environment", "local");
}

export function getGlobalOptions(command: Command): GlobalCliOptions {
  const opts = command.optsWithGlobals<GlobalCliOptions>();
  return opts;
}
