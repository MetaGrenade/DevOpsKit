import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type {
  NuiBridgeDefinitions,
  NuiBridgeRegistry,
  NuiFieldDefinition,
  NuiSchemaSyncFinding,
  NuiSchemaSyncReport,
  NuiSchemaSyncResourceReport,
} from "@fdt/schemas";
import { NuiBridgeRegistrySchema, NuiSchemaSyncReportSchema } from "@fdt/schemas";
import { discoverResourceNames } from "./detect-framework.js";
import { resolveResourceDirectory } from "./resource-path.js";

export const CALLBACKS_START = "-- fdt:nui-callbacks-start";
export const CALLBACKS_END = "-- fdt:nui-callbacks-end";
export const MESSAGES_START = "-- fdt:nui-messages-start";
export const MESSAGES_END = "-- fdt:nui-messages-end";
export const FETCH_START = "// fdt:nui-fetch-start";
export const FETCH_END = "// fdt:nui-fetch-end";
export const SCHEMA_CALLBACKS_START = "// fdt:callback-types-start";
export const SCHEMA_CALLBACKS_END = "// fdt:callback-types-end";
export const SCHEMA_MESSAGES_START = "// fdt:message-types-start";
export const SCHEMA_MESSAGES_END = "// fdt:message-types-end";

const DEFAULT_CALLBACK_DEFINITIONS: NuiBridgeDefinitions["callbacks"] = {
  close: { payload: {} },
  ping: { payload: { hello: { type: "string", optional: true } } },
};

const DEFAULT_MESSAGE_DEFINITIONS: NuiBridgeDefinitions["messages"] = {
  setVisible: { payload: { visible: { type: "boolean" } } },
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceBetween(content: string, start: string, end: string, body: string): string {
  const pattern = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`);
  if (!pattern.test(content)) {
    throw new Error(`Missing bridge marker block: ${start}`);
  }
  return content.replace(pattern, `${start}\n${body}\n${end}`);
}

function extractBetween(content: string, start: string, end: string): string | null {
  const pattern = new RegExp(`${escapeRegExp(start)}\\n([\\s\\S]*?)\\n${escapeRegExp(end)}`);
  const match = content.match(pattern);
  return match?.[1] ?? null;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function renderTsField(name: string, field: NuiFieldDefinition): string {
  const optional = field.optional ? "?" : "";
  switch (field.type) {
    case "string":
      return `${name}${optional}: string;`;
    case "number":
      return `${name}${optional}: number;`;
    case "boolean":
      return `${name}${optional}: boolean;`;
    case "array":
      return `${name}${optional}: ${renderTsType(field.items ?? { type: "unknown" })}[];`;
    case "object":
      return `${name}${optional}: ${renderTsObjectType(field.properties ?? {})};`;
    default:
      return `${name}${optional}: unknown;`;
  }
}

function renderTsObjectType(properties: Record<string, NuiFieldDefinition>): string {
  const entries = Object.entries(properties);
  if (entries.length === 0) {
    return "Record<string, unknown>";
  }
  return `{\n${entries.map(([name, field]) => `    ${renderTsField(name, field)}`).join("\n")}\n  }`;
}

function renderTsType(field: NuiFieldDefinition): string {
  switch (field.type) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "array":
      return `${renderTsType(field.items ?? { type: "unknown" })}[]`;
    case "object":
      return renderTsObjectType(field.properties ?? {});
    default:
      return "unknown";
  }
}

function renderCallbackPayloadType(name: string, definition: NuiBridgeDefinitions["callbacks"][string]): string {
  const fields = Object.entries(definition.payload);
  if (fields.length === 0) {
    return name === "close" ? `  ${name}: Record<string, never>;` : `  ${name}: Record<string, unknown>;`;
  }
  return `  ${name}: ${renderTsObjectType(definition.payload)};`;
}

function renderMessagePayloadType(name: string, definition: NuiBridgeDefinitions["messages"][string]): string {
  const fields = Object.entries(definition.payload);
  if (fields.length === 0) {
    return `  ${name}: Record<string, unknown>;`;
  }
  return `  ${name}: ${renderTsObjectType(definition.payload)};`;
}

export function normalizeNuiBridgeRegistry(registry: NuiBridgeRegistry): NuiBridgeRegistry {
  const definitions: NuiBridgeDefinitions = {
    callbacks: { ...(registry.definitions?.callbacks ?? {}) },
    messages: { ...(registry.definitions?.messages ?? {}) },
  };

  for (const callback of registry.callbacks) {
    definitions.callbacks[callback] ??= DEFAULT_CALLBACK_DEFINITIONS[callback] ?? { payload: {} };
  }

  for (const message of registry.messages) {
    definitions.messages[message] ??= DEFAULT_MESSAGE_DEFINITIONS[message] ?? { payload: {} };
  }

  return NuiBridgeRegistrySchema.parse({
    ...registry,
    definitions,
  });
}

export function renderCallbackLua(name: string): string {
  return [
    `RegisterNUICallback('${name}', function(data, cb)`,
    "    cb({ ok = true, data = data })",
    "end)",
    "",
  ].join("\n");
}

export function renderMessageLua(name: string): string {
  const functionName = name.charAt(0).toUpperCase() + name.slice(1);
  return [
    `function Send${functionName}(payload)`,
    "    SendNUIMessage({",
    `        action = '${name}',`,
    "        payload = payload or {}",
    "    })",
    "end",
    "",
  ].join("\n");
}

export function renderCallbackSchemas(registry: NuiBridgeRegistry): string {
  const normalized = normalizeNuiBridgeRegistry(registry);
  const callbackUnion = normalized.callbacks.map((name) => `"${name}"`).join(" | ");
  const callbackPayloads = normalized.callbacks
    .map((name) => renderCallbackPayloadType(name, normalized.definitions!.callbacks[name]!))
    .join("\n");

  return [
    `export type NuiCallbackName = ${callbackUnion};`,
    "",
    "export interface NuiCallbackPayloads {",
    callbackPayloads,
    "}",
    "",
  ].join("\n");
}

export function renderMessageSchemas(registry: NuiBridgeRegistry): string {
  const normalized = normalizeNuiBridgeRegistry(registry);
  const messageUnion = normalized.messages.map((name) => `"${name}"`).join(" | ");
  const messagePayloads = normalized.messages
    .map((name) => renderMessagePayloadType(name, normalized.definitions!.messages[name]!))
    .join("\n");

  return [
    `export type NuiMessageAction = ${messageUnion};`,
    "",
    "export interface NuiMessagePayloads {",
    messagePayloads,
    "}",
    "",
  ].join("\n");
}

export function renderFivemTs(registry: NuiBridgeRegistry): string {
  const normalized = normalizeNuiBridgeRegistry(registry);
  const helperLines = normalized.callbacks.map((callback) => {
    const fn = callback.charAt(0).toLowerCase() + callback.slice(1);
    if (callback === "close") {
      return ['export async function close() {', `  return nuiFetch<{ ok: boolean }>("${callback}");`, "}", ""].join("\n");
    }
    const payloadType = `NuiCallbackPayloads["${callback}"]`;
    return [
      `export async function ${fn}(data?: ${payloadType}) {`,
      `  return nuiFetch<{ ok: boolean; data?: unknown; resource?: string; echo?: unknown }>("${callback}", data);`,
      "}",
      "",
    ].join("\n");
  });

  return [
    'import type { NuiCallbackPayloads } from "./schemas";',
    "",
    FETCH_START,
    "export function nuiFetch<T>(event: string, data?: unknown): Promise<T> {",
    "  const resourceName =",
    `    typeof GetParentResourceName === "function" ? GetParentResourceName() : "${normalized.resourceName}";`,
    "",
    "  return fetch(`https://${resourceName}/${event}`, {",
    '    method: "POST",',
    '    headers: { "Content-Type": "application/json; charset=UTF-8" },',
    "    body: JSON.stringify(data ?? {}),",
    "  }).then((res) => res.json() as Promise<T>);",
    "}",
    "",
    "declare function GetParentResourceName(): string;",
    "",
    ...helperLines,
    FETCH_END,
    "",
  ].join("\n");
}

export function renderMessagesTs(registry: NuiBridgeRegistry): string {
  const normalized = normalizeNuiBridgeRegistry(registry);
  return [
    'import type { NuiMessageAction, NuiMessagePayloads } from "./schemas";',
    "",
    "export type NuiMessageHandler = {",
    ...normalized.messages.map(
      (message) => `  ${message}?: (payload: NuiMessagePayloads[${JSON.stringify(message)}]) => void;`,
    ),
    "};",
    "",
    "export function handleNuiMessage<T extends NuiMessageAction>(",
    "  action: T,",
    "  payload: NuiMessagePayloads[T],",
    "  handlers: NuiMessageHandler,",
    "): void {",
    "  const handler = handlers[action as keyof NuiMessageHandler];",
    "  if (typeof handler === \"function\") {",
    "    handler(payload as never);",
    "  }",
    "}",
    "",
  ].join("\n");
}

export async function syncNuiBridgeSchemas(resourceRoot: string, registry?: NuiBridgeRegistry): Promise<NuiBridgeRegistry> {
  const loaded = registry ?? (await loadNuiBridgeRegistry(resourceRoot));
  const normalized = normalizeNuiBridgeRegistry(loaded);

  const clientPath = path.join(resourceRoot, "client", "main.lua");
  const fivemPath = path.join(resourceRoot, "web", "src", "fivem.ts");
  const schemasPath = path.join(resourceRoot, "web", "src", "schemas.ts");
  const messagesPath = path.join(resourceRoot, "web", "src", "messages.ts");

  const client = await readFile(clientPath, "utf8");
  const schemas = await readFile(schemasPath, "utf8");

  await writeFile(
    clientPath,
    replaceBetween(
      client,
      CALLBACKS_START,
      CALLBACKS_END,
      normalized.callbacks.map(renderCallbackLua).join("\n"),
    ),
    "utf8",
  );

  await writeFile(
    clientPath,
    replaceBetween(
      await readFile(clientPath, "utf8"),
      MESSAGES_START,
      MESSAGES_END,
      normalized.messages.map(renderMessageLua).join("\n"),
    ),
    "utf8",
  );

  await writeFile(fivemPath, renderFivemTs(normalized), "utf8");
  await writeFile(
    schemasPath,
    replaceBetween(schemas, SCHEMA_CALLBACKS_START, SCHEMA_CALLBACKS_END, renderCallbackSchemas(normalized)),
    "utf8",
  );
  await writeFile(
    schemasPath,
    replaceBetween(
      await readFile(schemasPath, "utf8"),
      SCHEMA_MESSAGES_START,
      SCHEMA_MESSAGES_END,
      renderMessageSchemas(normalized),
    ),
    "utf8",
  );
  await writeFile(messagesPath, renderMessagesTs(normalized), "utf8");
  await saveNuiBridgeRegistry(resourceRoot, normalized);

  return normalized;
}

export async function loadNuiBridgeRegistry(resourceRoot: string): Promise<NuiBridgeRegistry> {
  const registryPath = path.join(resourceRoot, "shared", "nui-bridge.json");
  const raw = JSON.parse(await readFile(registryPath, "utf8")) as unknown;
  return normalizeNuiBridgeRegistry(NuiBridgeRegistrySchema.parse(raw));
}

export async function saveNuiBridgeRegistry(resourceRoot: string, registry: NuiBridgeRegistry): Promise<void> {
  const registryPath = path.join(resourceRoot, "shared", "nui-bridge.json");
  await writeFile(registryPath, `${JSON.stringify(normalizeNuiBridgeRegistry(registry), null, 2)}\n`, "utf8");
}

export async function validateNuiSchemaSync(
  resourceRoot: string,
  resourceName: string,
  resourcePath?: string,
): Promise<NuiSchemaSyncResourceReport> {
  const findings: NuiSchemaSyncFinding[] = [];
  const registry = await loadNuiBridgeRegistry(resourceRoot);
  const expectedCallbacks = registry.callbacks.map(renderCallbackLua).join("\n");
  const expectedMessages = registry.messages.map(renderMessageLua).join("\n");
  const expectedSchemasCallbacks = renderCallbackSchemas(registry);
  const expectedSchemasMessages = renderMessageSchemas(registry);
  const expectedFivem = renderFivemTs(registry);
  const expectedMessagesTs = renderMessagesTs(registry);

  const clientPath = path.join(resourceRoot, "client", "main.lua");
  const fivemPath = path.join(resourceRoot, "web", "src", "fivem.ts");
  const schemasPath = path.join(resourceRoot, "web", "src", "schemas.ts");
  const messagesPath = path.join(resourceRoot, "web", "src", "messages.ts");

  const client = await readFile(clientPath, "utf8");
  const fivem = await readFile(fivemPath, "utf8");
  const schemas = await readFile(schemasPath, "utf8");
  const messages = await readFile(messagesPath, "utf8");

  if (normalizeWhitespace(extractBetween(client, CALLBACKS_START, CALLBACKS_END) ?? "") !== normalizeWhitespace(expectedCallbacks)) {
    findings.push({
      id: `callback-drift:${resourceName}`,
      severity: "error",
      code: "nui_callback_schema_drift",
      message: "client/main.lua callback block is out of sync with shared/nui-bridge.json",
      resourceName,
      file: "client/main.lua",
    });
  }

  if (normalizeWhitespace(extractBetween(client, MESSAGES_START, MESSAGES_END) ?? "") !== normalizeWhitespace(expectedMessages)) {
    findings.push({
      id: `message-drift:${resourceName}`,
      severity: "error",
      code: "nui_message_schema_drift",
      message: "client/main.lua message block is out of sync with shared/nui-bridge.json",
      resourceName,
      file: "client/main.lua",
    });
  }

  if (normalizeWhitespace(extractBetween(schemas, SCHEMA_CALLBACKS_START, SCHEMA_CALLBACKS_END) ?? "") !== normalizeWhitespace(expectedSchemasCallbacks)) {
    findings.push({
      id: `schema-callback-drift:${resourceName}`,
      severity: "error",
      code: "nui_typescript_callback_drift",
      message: "web/src/schemas.ts callback types are out of sync with shared/nui-bridge.json",
      resourceName,
      file: "web/src/schemas.ts",
    });
  }

  if (normalizeWhitespace(extractBetween(schemas, SCHEMA_MESSAGES_START, SCHEMA_MESSAGES_END) ?? "") !== normalizeWhitespace(expectedSchemasMessages)) {
    findings.push({
      id: `schema-message-drift:${resourceName}`,
      severity: "error",
      code: "nui_typescript_message_drift",
      message: "web/src/schemas.ts message types are out of sync with shared/nui-bridge.json",
      resourceName,
      file: "web/src/schemas.ts",
    });
  }

  if (normalizeWhitespace(fivem) !== normalizeWhitespace(expectedFivem)) {
    findings.push({
      id: `fivem-drift:${resourceName}`,
      severity: "warning",
      code: "nui_fivem_wrapper_drift",
      message: "web/src/fivem.ts is out of sync with shared/nui-bridge.json",
      resourceName,
      file: "web/src/fivem.ts",
    });
  }

  if (normalizeWhitespace(messages) !== normalizeWhitespace(expectedMessagesTs)) {
    findings.push({
      id: `messages-ts-drift:${resourceName}`,
      severity: "warning",
      code: "nui_messages_handler_drift",
      message: "web/src/messages.ts is out of sync with shared/nui-bridge.json",
      resourceName,
      file: "web/src/messages.ts",
    });
  }

  return {
    resourceName,
    resourcePath: resourcePath ?? resourceRoot,
    synced: findings.length === 0,
    findings,
  };
}

export interface DiscoveredNuiResource {
  resourceName: string;
  resourcePath: string;
  resourceRoot: string;
}

export async function discoverNuiResources(workspaceRoot: string, resourcesRoot: string): Promise<DiscoveredNuiResource[]> {
  const resourcesAbs = path.resolve(workspaceRoot, resourcesRoot);
  const discovered: DiscoveredNuiResource[] = [];

  for (const resourceName of discoverResourceNames(resourcesAbs)) {
    const resolved = resolveResourceDirectory(workspaceRoot, resourcesRoot, resourceName);
    if (!resolved) {
      continue;
    }

    const bridgePath = path.join(resolved.resourceRoot, "shared", "nui-bridge.json");
    if (!existsSync(bridgePath)) {
      continue;
    }

    discovered.push({
      resourceName,
      resourcePath: resolved.resourcePath,
      resourceRoot: resolved.resourceRoot,
    });
  }

  return discovered.sort((a, b) => a.resourceName.localeCompare(b.resourceName));
}

export async function validateWorkspaceNuiSchemas(options: {
  workspaceName: string;
  workspaceRoot: string;
  resourcesRoot: string;
}): Promise<NuiSchemaSyncReport> {
  const resources = await discoverNuiResources(options.workspaceRoot, options.resourcesRoot);
  const reports: NuiSchemaSyncResourceReport[] = [];

  for (const resource of resources) {
    reports.push(await validateNuiSchemaSync(resource.resourceRoot, resource.resourceName, resource.resourcePath));
  }

  const errors = reports.reduce((sum, report) => sum + report.findings.filter((finding) => finding.severity === "error").length, 0);
  const warnings = reports.reduce((sum, report) => sum + report.findings.filter((finding) => finding.severity === "warning").length, 0);

  return NuiSchemaSyncReportSchema.parse({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    workspaceName: options.workspaceName,
    workspaceRoot: options.workspaceRoot,
    summary: {
      resourcesChecked: reports.length,
      synced: reports.filter((report) => report.synced).length,
      errors,
      warnings,
    },
    resources: reports,
  });
}

export async function syncWorkspaceNuiSchemas(options: {
  workspaceRoot: string;
  resourcesRoot: string;
}): Promise<DiscoveredNuiResource[]> {
  const resources = await discoverNuiResources(options.workspaceRoot, options.resourcesRoot);
  for (const resource of resources) {
    await syncNuiBridgeSchemas(resource.resourceRoot);
  }
  return resources;
}
