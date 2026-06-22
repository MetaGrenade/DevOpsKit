import type { ResourceManifest } from "@fdt/schemas";

const SCRIPT_KEYS = new Set([
  "client_script",
  "client_scripts",
  "server_script",
  "server_scripts",
  "shared_script",
  "shared_scripts",
]);

const FILE_LIST_KEYS = new Set([
  ...SCRIPT_KEYS,
  "files",
  "file",
  "dependency",
  "dependencies",
  "provides",
  "escrow_ignore",
]);

export interface ParsedManifest extends ResourceManifest {
  referencedPaths: string[];
}

function stripComments(source: string): string {
  return source
    .replace(/--\[\[[\s\S]*?\]\]/g, "")
    .replace(/--.*$/gm, "");
}

function extractQuotedStrings(value: string): string[] {
  const results: string[] = [];
  const pattern = /(['"])(?:(?=(\\?))\2.)*?\1/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    const raw = match[0];
    results.push(raw.slice(1, -1).replace(/\\(['"])/g, "$1"));
  }

  return results;
}

function parseDirectiveLine(line: string): { key: string; values: string[] } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("--")) {
    return null;
  }

  const match = trimmed.match(/^([a-zA-Z0-9_]+)\s*(.+)?$/);
  if (!match) {
    return null;
  }

  const key = match[1]!.toLowerCase();
  const remainder = (match[2] ?? "").trim();

  if (!remainder) {
    return { key, values: [] };
  }

  if (remainder.startsWith("{")) {
    return { key, values: extractQuotedStrings(remainder) };
  }

  return { key, values: extractQuotedStrings(remainder) };
}

function pushUnique(target: string[], values: string[]): void {
  for (const value of values) {
    if (!target.includes(value)) {
      target.push(value);
    }
  }
}

function isTruthyFlag(value: string | undefined): boolean {
  if (!value) {
    return true;
  }

  const normalized = value.toLowerCase();
  return normalized === "yes" || normalized === "true" || normalized === "1";
}

function addDependency(manifest: ParsedManifest, value: string): void {
  if (value.startsWith("/")) {
    pushUnique(manifest.runtimeDependencies, [value]);
    return;
  }

  pushUnique(manifest.dependencies, [value]);
}

function applyManifestDirective(manifest: ParsedManifest, key: string, values: string[]): void {
  switch (key) {
    case "fx_version":
      manifest.fxVersion = values[0];
      break;
    case "resource_manifest_version":
      manifest.resourceManifestVersion = values[0];
      break;
    case "version":
      manifest.version = values[0];
      break;
    case "author":
      manifest.author = values[0];
      break;
    case "description":
      manifest.description = values[0];
      break;
    case "game":
    case "games":
      pushUnique(manifest.games, values);
      break;
    case "lua54":
      manifest.lua54 = isTruthyFlag(values[0]);
      break;
    case "server_only":
      manifest.serverOnly = isTruthyFlag(values[0]);
      break;
    case "this_is_a_map":
      manifest.isMap = isTruthyFlag(values[0]);
      break;
    case "ui_page":
      manifest.uiPage = values[0];
      if (values[0]) {
        pushUnique(manifest.referencedPaths, [values[0]]);
      }
      break;
    case "loadscreen":
      manifest.loadscreen = values[0];
      if (values[0]) {
        pushUnique(manifest.referencedPaths, [values[0]]);
      }
      break;
    case "client_script":
    case "client_scripts":
      pushUnique(manifest.clientScripts, values);
      pushUnique(manifest.referencedPaths, values);
      break;
    case "server_script":
    case "server_scripts":
      pushUnique(manifest.serverScripts, values);
      pushUnique(manifest.referencedPaths, values);
      break;
    case "shared_script":
    case "shared_scripts":
      pushUnique(manifest.sharedScripts, values);
      pushUnique(manifest.referencedPaths, values);
      break;
    case "files":
      pushUnique(manifest.files, values);
      pushUnique(manifest.referencedPaths, values);
      break;
    case "file":
      pushUnique(manifest.fileEntries, values);
      pushUnique(manifest.referencedPaths, values);
      break;
    case "dependency":
      for (const value of values) {
        addDependency(manifest, value);
      }
      break;
    case "dependencies":
      for (const value of values) {
        addDependency(manifest, value);
      }
      break;
    case "provides":
      pushUnique(manifest.provides, values);
      break;
    case "escrow_ignore":
      pushUnique(manifest.escrowIgnore, values);
      pushUnique(manifest.referencedPaths, values);
      break;
    default:
      if (FILE_LIST_KEYS.has(key) && values.length > 0) {
        pushUnique(manifest.referencedPaths, values);
      }
      break;
  }
}

export function parseFxManifest(raw: string, manifestType: "fxmanifest" | "legacy_resource"): ParsedManifest {
  const cleaned = stripComments(raw);
  const manifest: ParsedManifest = {
    type: manifestType,
    games: [],
    clientScripts: [],
    serverScripts: [],
    sharedScripts: [],
    files: [],
    fileEntries: [],
    dependencies: [],
    runtimeDependencies: [],
    provides: [],
    escrowIgnore: [],
    referencedPaths: [],
    raw,
  };

  let pendingBlock: { key: string; buffer: string } | null = null;

  for (const line of cleaned.split(/\r?\n/)) {
    if (pendingBlock) {
      pendingBlock.buffer += `\n${line}`;
      if (line.includes("}")) {
        applyManifestDirective(
          manifest,
          pendingBlock.key,
          extractQuotedStrings(pendingBlock.buffer),
        );
        pendingBlock = null;
      }
      continue;
    }

    const directive = parseDirectiveLine(line);
    if (!directive) {
      continue;
    }

    const { key, values } = directive;
    const trimmed = line.trim();
    const opensBlock = trimmed.includes("{") && !trimmed.includes("}");

    if (opensBlock) {
      pendingBlock = { key, buffer: trimmed.slice(trimmed.indexOf("{")) };
      continue;
    }

    applyManifestDirective(manifest, key, values);
  }

  if (manifest.uiPage && !manifest.files.includes(manifest.uiPage)) {
    pushUnique(manifest.referencedPaths, [manifest.uiPage]);
  }

  return manifest;
}

export function emptyMissingManifest(): ParsedManifest {
  return {
    type: "missing",
    games: [],
    clientScripts: [],
    serverScripts: [],
    sharedScripts: [],
    files: [],
    fileEntries: [],
    dependencies: [],
    runtimeDependencies: [],
    provides: [],
    escrowIgnore: [],
    referencedPaths: [],
  };
}
