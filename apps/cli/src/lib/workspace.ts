import type { GlobalCliOptions } from "../lib/global-options.js";
import { loadWorkspaceConfig } from "@fdt/core";
import path from "node:path";

export async function requireWorkspace(globals: GlobalCliOptions) {
  const workspaceRoot = path.resolve(globals.workspace ?? process.cwd());
  const discovery = await loadWorkspaceConfig({
    workspaceRoot,
    configPath: globals.config,
  });

  if (discovery.status === "not_found") {
    console.error("Workspace config not found.");
    console.error("Searched:");
    for (const candidate of discovery.searchedPaths) {
      console.error(`  - ${candidate}`);
    }
    console.error("Run `fdt init` to create fdt.workspace.json");
    process.exit(2);
  }

  return {
    workspaceRoot,
    workspace: discovery.workspace,
    configPath: discovery.configPath,
  };
}
