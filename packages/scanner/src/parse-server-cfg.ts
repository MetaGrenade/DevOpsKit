import { readFile } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

export interface ServerCfgLineEntry {
  line: number;
  command: "start" | "ensure";
  resource: string;
  file: string;
}

export interface ServerCfgMissingExec {
  file: string;
  line: number;
  target: string;
}

export interface ServerCfgResourceRef {
  name: string;
  path: string;
}

export type ServerCfgCommand = "start" | "ensure" | "stop";

export interface ServerCfgAction {
  line: number;
  command: ServerCfgCommand;
  target: string;
  isCategory: boolean;
  file: string;
}

export interface ServerCfgParseResult {
  path: string;
  started: string[];
  ensured: string[];
  stopped: string[];
  lines: ServerCfgLineEntry[];
  executedFiles: string[];
  missingExecs: ServerCfgMissingExec[];
}

const RESOURCE_COMMAND_PATTERN = /^\s*(ensure|start|stop)\s+([^\s#;]+)/i;
const EXEC_PATTERN = /^\s*exec\s+([^\s#;]+)/i;
const CATEGORY_PATTERN = /^\[(.+)\]$/;

function stripQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, "");
}

function parseCategoryTarget(target: string): { isCategory: boolean; value: string } {
  const cleaned = stripQuotes(target);
  const match = cleaned.match(CATEGORY_PATTERN);
  if (!match) {
    return { isCategory: false, value: cleaned };
  }

  return { isCategory: true, value: `[${match[1]!}]` };
}

function parseServerCfgContent(content: string, filePath: string): {
  events: Array<
    | { type: "action"; action: ServerCfgAction }
    | { type: "exec"; line: number; target: string }
  >;
} {
  const events: Array<
    | { type: "action"; action: ServerCfgAction }
    | { type: "exec"; line: number; target: string }
  > = [];

  content.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.split("#")[0]!.trim();
    if (!line) {
      return;
    }

    const execMatch = line.match(EXEC_PATTERN);
    if (execMatch) {
      events.push({
        type: "exec",
        line: index + 1,
        target: stripQuotes(execMatch[1]!),
      });
      return;
    }

    const commandMatch = line.match(RESOURCE_COMMAND_PATTERN);
    if (!commandMatch) {
      return;
    }

    const command = commandMatch[1]!.toLowerCase() as ServerCfgCommand;
    const { isCategory, value } = parseCategoryTarget(commandMatch[2]!);

    events.push({
      type: "action",
      action: {
        line: index + 1,
        command,
        target: value,
        isCategory,
        file: filePath,
      },
    });
  });

  return { events };
}

function resourceAbsolutePath(workspaceRoot: string, resourcePath: string): string {
  return path.resolve(workspaceRoot, resourcePath);
}

function resourcesInCategoryFolder(
  categoryFolder: string,
  resources: ServerCfgResourceRef[],
  resourcesRoot: string,
  workspaceRoot: string,
): string[] {
  const matches: string[] = [];

  for (const resource of resources) {
    const absoluteResourcePath = resourceAbsolutePath(workspaceRoot, resource.path);
    const relative = path.relative(resourcesRoot, absoluteResourcePath);
    if (relative.startsWith("..")) {
      continue;
    }

    const parts = relative.split(path.sep);
    const categoryIndex = parts.indexOf(categoryFolder);
    if (categoryIndex === -1) {
      continue;
    }

    // Match FiveM folder ensures: direct child resources of the category folder.
    if (parts.length !== categoryIndex + 2) {
      continue;
    }

    if (!matches.includes(resource.name)) {
      matches.push(resource.name);
    }
  }

  return matches.sort((a, b) => a.localeCompare(b));
}

export function resolveServerCfgState(
  actions: ServerCfgAction[],
  resources: ServerCfgResourceRef[],
  resourcesRoot: string,
  workspaceRoot: string,
): Pick<ServerCfgParseResult, "started" | "ensured" | "stopped" | "lines"> {
  const startedSet = new Set<string>();
  const ensuredSet = new Set<string>();
  const stoppedSet = new Set<string>();
  const lines: ServerCfgLineEntry[] = [];

  for (const action of actions) {
    const targets = action.isCategory
      ? resourcesInCategoryFolder(action.target, resources, resourcesRoot, workspaceRoot)
      : [action.target];

    if (action.command === "stop") {
      for (const target of targets) {
        stoppedSet.add(target);
        startedSet.delete(target);
        ensuredSet.delete(target);
      }
      continue;
    }

    for (const target of targets) {
      stoppedSet.delete(target);

      if (action.command === "start") {
        startedSet.add(target);
      } else {
        ensuredSet.add(target);
      }

      if (!action.isCategory) {
        lines.push({
          line: action.line,
          command: action.command,
          resource: target,
          file: action.file,
        });
      }
    }
  }

  return {
    started: [...startedSet].sort((a, b) => a.localeCompare(b)),
    ensured: [...ensuredSet].sort((a, b) => a.localeCompare(b)),
    stopped: [...stoppedSet].sort((a, b) => a.localeCompare(b)),
    lines,
  };
}

export function parseServerCfg(content: string, filePath: string): ServerCfgParseResult {
  const parsed = parseServerCfgContent(content, filePath);
  const actions = parsed.events
    .filter((event): event is { type: "action"; action: ServerCfgAction } => event.type === "action")
    .map((event) => event.action);
  const resolved = resolveServerCfgState(actions, [], "", "");

  return {
    path: filePath,
    started: resolved.started,
    ensured: resolved.ensured,
    stopped: resolved.stopped,
    lines: resolved.lines,
    executedFiles: filePath ? [filePath] : [],
    missingExecs: [],
  };
}

export interface LoadServerCfgOptions {
  workspaceRoot: string;
  resourcesRoot?: string;
  serverDataRoot?: string;
  resources?: ServerCfgResourceRef[];
  resolveResourcePath?: (resourceName: string) => string | undefined;
}

function defaultResolveResourcePath(
  workspaceRoot: string,
  resourcesRoot: string,
  resourceName: string,
): string | undefined {
  if (!existsSync(resourcesRoot)) {
    return undefined;
  }

  const direct = path.join(resourcesRoot, resourceName);
  if (existsSync(direct)) {
    return path.relative(workspaceRoot, direct).replace(/\\/g, "/");
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
}

function resolveExecTarget(
  target: string,
  currentFile: string,
  options: LoadServerCfgOptions,
): string | null {
  const cleaned = stripQuotes(target);
  const serverDataRoot = options.serverDataRoot ?? path.dirname(currentFile);

  if (cleaned.startsWith("@")) {
    const withoutAt = cleaned.slice(1);
    const slashIndex = withoutAt.indexOf("/");
    const resourceName = slashIndex === -1 ? withoutAt : withoutAt.slice(0, slashIndex);
    const rest = slashIndex === -1 ? "" : withoutAt.slice(slashIndex + 1);

    const resolver =
      options.resolveResourcePath ??
      ((name: string) =>
        defaultResolveResourcePath(
          options.workspaceRoot,
          options.resourcesRoot ?? path.join(options.workspaceRoot, "server", "resources"),
          name,
        ));

    const resourcePath = resolver(resourceName);
    if (!resourcePath) {
      return null;
    }

    const absoluteResourceRoot = path.resolve(options.workspaceRoot, resourcePath);
    return rest ? path.resolve(absoluteResourceRoot, rest) : absoluteResourceRoot;
  }

  if (path.isAbsolute(cleaned)) {
    return existsSync(cleaned) ? cleaned : null;
  }

  const fromServerDataRoot = path.resolve(serverDataRoot, cleaned);
  if (existsSync(fromServerDataRoot)) {
    return fromServerDataRoot;
  }

  const relativeToCurrent = path.resolve(path.dirname(currentFile), cleaned);
  if (existsSync(relativeToCurrent)) {
    return relativeToCurrent;
  }

  const relativeToWorkspace = path.resolve(options.workspaceRoot, cleaned);
  if (existsSync(relativeToWorkspace)) {
    return relativeToWorkspace;
  }

  return null;
}

export async function loadServerCfg(
  entryAbsolutePath: string,
  options: LoadServerCfgOptions,
): Promise<ServerCfgParseResult> {
  const entryDisplayPath = path
    .relative(options.workspaceRoot, entryAbsolutePath)
    .replace(/\\/g, "/");
  const resourcesRoot =
    options.resourcesRoot ?? path.join(options.workspaceRoot, "server", "resources");
  const serverDataRoot = options.serverDataRoot ?? path.dirname(entryAbsolutePath);
  const resources = options.resources ?? [];
  const visited = new Set<string>();
  const orderedActions: ServerCfgAction[] = [];
  const executedFiles: string[] = [];
  const missingExecs: ServerCfgMissingExec[] = [];

  async function walk(absolutePath: string, displayPath: string): Promise<void> {
    const canonical = path.resolve(absolutePath);
    if (visited.has(canonical)) {
      return;
    }
    visited.add(canonical);

    if (!existsSync(canonical)) {
      missingExecs.push({ file: displayPath, line: 0, target: displayPath });
      return;
    }

    executedFiles.push(displayPath);

    const content = await readFile(canonical, "utf8");
    const parsed = parseServerCfgContent(content, displayPath);

    for (const event of parsed.events) {
      if (event.type === "action") {
        orderedActions.push(event.action);
        continue;
      }

      const resolved = resolveExecTarget(event.target, canonical, {
        ...options,
        serverDataRoot,
      });
      if (!resolved || !existsSync(resolved)) {
        missingExecs.push({
          file: displayPath,
          line: event.line,
          target: event.target,
        });
        continue;
      }

      const nestedDisplayPath = path.relative(options.workspaceRoot, resolved).replace(/\\/g, "/");
      await walk(resolved, nestedDisplayPath);
    }
  }

  await walk(entryAbsolutePath, entryDisplayPath);

  const resolved = resolveServerCfgState(
    orderedActions,
    resources,
    resourcesRoot,
    options.workspaceRoot,
  );

  return {
    path: entryDisplayPath,
    started: resolved.started,
    ensured: resolved.ensured,
    stopped: resolved.stopped,
    lines: resolved.lines,
    executedFiles: [...new Set(executedFiles)],
    missingExecs,
  };
}

export function allStartedResources(result: ServerCfgParseResult): string[] {
  const stopped = new Set(result.stopped);
  return [...new Set([...result.started, ...result.ensured])].filter(
    (resource) => !stopped.has(resource),
  );
}

export function isResourceStarted(
  resourceName: string,
  result: ServerCfgParseResult,
): boolean {
  if (result.stopped.includes(resourceName)) {
    return false;
  }

  return result.started.includes(resourceName) || result.ensured.includes(resourceName);
}
