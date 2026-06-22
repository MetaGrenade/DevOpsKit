import { access } from "node:fs/promises";
import path from "node:path";
import type { NuiBridgeRegistry } from "@fdt/schemas";
import {
  loadNuiBridgeRegistry,
  saveNuiBridgeRegistry,
  syncNuiBridgeSchemas,
} from "./nui-schema-sync.js";

function sanitizeResourceName(name: string): string {
  const cleaned = name.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
  if (!/^[a-z][a-z0-9_]*$/.test(cleaned)) {
    throw new Error("Resource name must start with a letter and use lowercase letters, numbers, or underscores");
  }
  return cleaned;
}

function sanitizeBridgeName(name: string): string {
  const cleaned = name.trim().replace(/[^a-zA-Z0-9_]+/g, "");
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(cleaned)) {
    throw new Error("Callback/message names must start with a letter and use letters, numbers, or underscores");
  }
  return cleaned;
}

export function resolveNuiResourceRoot(
  workspaceRoot: string,
  resourcesRoot: string,
  resourceName: string,
): string {
  return path.resolve(workspaceRoot, resourcesRoot, sanitizeResourceName(resourceName));
}

export async function addNuiCallback(resourceRoot: string, callbackName: string): Promise<NuiBridgeRegistry> {
  const name = sanitizeBridgeName(callbackName);
  const registry = await loadNuiBridgeRegistry(resourceRoot);

  if (registry.callbacks.includes(name)) {
    throw new Error(`Callback already registered: ${name}`);
  }

  registry.callbacks = [...registry.callbacks, name].sort();
  registry.definitions = {
    callbacks: {
      ...(registry.definitions?.callbacks ?? {}),
      [name]: { payload: {} },
    },
    messages: registry.definitions?.messages ?? {},
  };

  await saveNuiBridgeRegistry(resourceRoot, registry);
  return syncNuiBridgeSchemas(resourceRoot, registry);
}

export async function addNuiMessage(resourceRoot: string, messageName: string): Promise<NuiBridgeRegistry> {
  const name = sanitizeBridgeName(messageName);
  const registry = await loadNuiBridgeRegistry(resourceRoot);

  if (registry.messages.includes(name)) {
    throw new Error(`Message already registered: ${name}`);
  }

  registry.messages = [...registry.messages, name].sort();
  registry.definitions = {
    callbacks: registry.definitions?.callbacks ?? {},
    messages: {
      ...(registry.definitions?.messages ?? {}),
      [name]: { payload: {} },
    },
  };

  await saveNuiBridgeRegistry(resourceRoot, registry);
  return syncNuiBridgeSchemas(resourceRoot, registry);
}

export async function assertNuiResource(resourceRoot: string): Promise<void> {
  try {
    await access(path.join(resourceRoot, "shared", "nui-bridge.json"));
  } catch {
    throw new Error(`NUI resource not found or missing shared/nui-bridge.json at ${resourceRoot}`);
  }
}

export {
  loadNuiBridgeRegistry,
  saveNuiBridgeRegistry,
  syncNuiBridgeSchemas,
  validateNuiSchemaSync,
  validateWorkspaceNuiSchemas,
  syncWorkspaceNuiSchemas,
  discoverNuiResources,
  normalizeNuiBridgeRegistry,
} from "./nui-schema-sync.js";

export { sanitizeResourceName, sanitizeBridgeName };
