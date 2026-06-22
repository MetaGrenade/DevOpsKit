import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import type {
  AdapterId,
  FrameworkProfile,
  FrameworkTarget,
  InventorySystem,
  Workspace,
  WorkspaceFrameworkOverride,
} from "@fdt/schemas";
import { loadServerCfg } from "@fdt/scanner";

const FRAMEWORK_MARKERS: Record<Exclude<FrameworkTarget, "custom">, string[]> = {
  qbox: ["qbx_core"],
  qbcore: ["qb-core"],
  esx: ["es_extended"],
  ox: ["ox_lib", "ox_inventory"],
};

const INVENTORY_MARKERS: Record<Exclude<InventorySystem, "custom">, string[]> = {
  "ox-inventory": ["ox_inventory"],
  qbcore: ["qb-inventory", "qb-core"],
  esx: ["es_extended"],
};

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function discoverResourceNames(resourcesRoot: string): Set<string> {
  const names = new Set<string>();

  if (!existsSync(resourcesRoot)) {
    return names;
  }

  for (const entry of readdirSync(resourcesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    if (entry.name.startsWith("[") && entry.name.endsWith("]")) {
      const categoryPath = path.join(resourcesRoot, entry.name);
      for (const child of readdirSync(categoryPath, { withFileTypes: true })) {
        if (child.isDirectory()) {
          names.add(child.name);
        }
      }
      continue;
    }

    names.add(entry.name);
  }

  return names;
}

async function discoverStartedResourceNames(
  workspaceRoot: string,
  workspace: Workspace,
): Promise<Set<string>> {
  const started = new Set<string>();
  const serverCfgPath = path.resolve(workspaceRoot, workspace.serverCfg);

  if (!existsSync(serverCfgPath)) {
    return started;
  }

  const resourcesRoot = path.resolve(workspaceRoot, workspace.resourcesRoot);
  const serverCfg = await loadServerCfg(serverCfgPath, {
    workspaceRoot,
    resourcesRoot,
    serverDataRoot: path.dirname(serverCfgPath),
    resources: [],
    resolveResourcePath: (resourceName) => {
      const direct = path.join(resourcesRoot, resourceName);
      if (existsSync(direct)) {
        return path.relative(workspaceRoot, direct).replace(/\\/g, "/");
      }

      if (!existsSync(resourcesRoot)) {
        return undefined;
      }

      for (const entry of readdirSync(resourcesRoot, { withFileTypes: true })) {
        if (!entry.isDirectory() || !entry.name.startsWith("[") || !entry.name.endsWith("]")) {
          continue;
        }

        const nested = path.join(resourcesRoot, entry.name, resourceName);
        if (existsSync(nested)) {
          return path.relative(workspaceRoot, nested).replace(/\\/g, "/");
        }
      }

      return undefined;
    },
  });

  for (const resource of serverCfg.started) {
    started.add(resource);
  }

  return started;
}

function detectFrameworkFromNames(resourceNames: Set<string>): {
  framework: FrameworkTarget;
  inventory: InventorySystem;
  detectedResources: string[];
} {
  const detectedResources: string[] = [];
  let framework: FrameworkTarget = "custom";
  let inventory: InventorySystem = "custom";

  const has = (names: string[]) => {
    const match = names.find((name) => resourceNames.has(name));
    if (match) {
      detectedResources.push(match);
      return true;
    }
    return false;
  };

  if (has(FRAMEWORK_MARKERS.qbox)) {
    framework = "qbox";
  } else if (has(FRAMEWORK_MARKERS.qbcore)) {
    framework = "qbcore";
  } else if (has(FRAMEWORK_MARKERS.esx)) {
    framework = "esx";
  } else if (has(FRAMEWORK_MARKERS.ox)) {
    framework = "ox";
  }

  if (has(INVENTORY_MARKERS["ox-inventory"])) {
    inventory = "ox-inventory";
  } else if (framework === "qbox") {
    inventory = "ox-inventory";
  } else if (has(INVENTORY_MARKERS.esx)) {
    inventory = "esx";
  } else if (has(INVENTORY_MARKERS.qbcore)) {
    inventory = "qbcore";
  }

  if (framework === "qbox" && inventory === "custom") {
    inventory = "ox-inventory";
  }

  if (framework === "esx" && resourceNames.has("ox_inventory")) {
    inventory = "ox-inventory";
  }

  return {
    framework,
    inventory,
    detectedResources: uniqueSorted(detectedResources),
  };
}

export function recommendAdapters(
  framework: FrameworkTarget,
  inventory: InventorySystem,
): AdapterId[] {
  const adapters: AdapterId[] = ["custom-json"];

  if (inventory === "ox-inventory") {
    adapters.push("ox-inventory");
  }

  if (framework === "qbox") {
    adapters.push("qbox");
  } else if (framework === "qbcore") {
    adapters.push("qbcore");
  } else if (framework === "esx") {
    adapters.push("esx");
  }

  return uniqueSorted(adapters) as AdapterId[];
}

function mergeManualOverride(
  autoDetected: ReturnType<typeof detectFrameworkFromNames>,
  manual?: WorkspaceFrameworkOverride,
): Pick<FrameworkProfile, "framework" | "inventory" | "source" | "manual"> {
  const hasManualFramework = manual?.framework !== undefined;
  const hasManualInventory = manual?.inventory !== undefined;

  const framework = manual?.framework ?? autoDetected.framework;
  const inventory = manual?.inventory ?? autoDetected.inventory;

  let source: FrameworkProfile["source"] = "detected";
  if (hasManualFramework && hasManualInventory) {
    source = "manual";
  } else if (hasManualFramework || hasManualInventory) {
    source = "mixed";
  }

  return {
    framework,
    inventory,
    source,
    manual: hasManualFramework || hasManualInventory ? manual : undefined,
  };
}

export interface DetectFrameworkProfileOptions {
  workspaceRoot: string;
  workspace: Workspace;
}

export async function detectFrameworkProfile(
  options: DetectFrameworkProfileOptions,
): Promise<FrameworkProfile> {
  const { workspaceRoot, workspace } = options;
  const resourcesRoot = path.resolve(workspaceRoot, workspace.resourcesRoot);

  const discovered = discoverResourceNames(resourcesRoot);
  const started = await discoverStartedResourceNames(workspaceRoot, workspace);
  const resourceNames = new Set([...discovered, ...started]);

  const autoDetected = detectFrameworkFromNames(resourceNames);
  const merged = mergeManualOverride(autoDetected, workspace.frameworkProfile);

  return {
    framework: merged.framework,
    inventory: merged.inventory,
    detectedResources: autoDetected.detectedResources,
    recommendedAdapters: recommendAdapters(merged.framework, merged.inventory),
    source: merged.source,
    manual: merged.manual,
    autoDetected,
  };
}
