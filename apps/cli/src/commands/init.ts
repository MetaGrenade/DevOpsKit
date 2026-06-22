import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { getGlobalOptions } from "../lib/global-options.js";

const DEFAULT_WORKSPACE = {
  schemaVersion: 1 as const,
  name: "My FiveM Server",
  serverRoot: "./server",
  resourcesRoot: "./server/resources",
  serverCfg: "./server/server.cfg",
  artifactOutput: "./.fdt/exports",
  frameworkTargets: ["custom", "qbcore", "esx", "ox"],
  rulesets: ["baseline", "performance", "security", "asset-streaming"],
  resourceIgnore: ["**/.git/**", "**/node_modules/**", "**/dist/**", "**/cache/**"],
  naming: {
    resourcePrefix: "meta",
    forbidSpaces: true,
    caseSensitivePaths: true,
  },
};

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize a new fdt.workspace.json in the current directory")
    .option("--name <name>", "Workspace display name")
    .option("--force", "Overwrite an existing workspace config")
    .action(async (options: { name?: string; force?: boolean }) => {
      const globals = getGlobalOptions(program);
      const workspaceRoot = path.resolve(globals.workspace ?? process.cwd());
      const configPath = path.join(workspaceRoot, "fdt.workspace.json");

      if (!options.force) {
        const { existsSync } = await import("node:fs");
        if (existsSync(configPath)) {
          console.error(`Workspace config already exists: ${configPath}`);
          console.error("Use --force to overwrite.");
          process.exit(2);
        }
      }

      const workspace = {
        ...DEFAULT_WORKSPACE,
        name: options.name ?? DEFAULT_WORKSPACE.name,
      };

      await writeFile(configPath, `${JSON.stringify(workspace, null, 2)}\n`, "utf8");
      await mkdir(path.join(workspaceRoot, ".fdt", "reports"), { recursive: true });
      await mkdir(path.join(workspaceRoot, ".fdt", "exports"), { recursive: true });

      if (globals.json) {
        console.log(JSON.stringify({ configPath, workspace }, null, 2));
      } else {
        console.log(`Created workspace config: ${configPath}`);
        console.log("Next steps:");
        console.log("  fdt scan resources");
        console.log("  fdt validate resources");
      }
    });
}
