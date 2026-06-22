import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type { DependencyGraphEdge, DependencyGraphNode, DependencyGraphReport, DependencyImpactReport, Resource, Workspace } from "@fdt/schemas";
import { DependencyGraphReportSchema, DependencyImpactReportSchema } from "@fdt/schemas";
import {
  allStartedResources,
  collectManifestReferencedPaths,
  isExternalResourceReference,
  isGlobPattern,
  isRemoteUrl,
  scanResources,
  type ScanResourcesResult,
} from "@fdt/scanner";

const EVENT_REGISTER_PATTERNS = [
  /RegisterNetEvent\s*\(\s*['"]([^'"]+)['"]/g,
  /AddEventHandler\s*\(\s*['"]([^'"]+)['"]/g,
  /RegisterServerEvent\s*\(\s*['"]([^'"]+)['"]/g,
];

const EVENT_TRIGGER_PATTERNS = [
  /TriggerEvent\s*\(\s*['"]([^'"]+)['"]/g,
  /TriggerServerEvent\s*\(\s*['"]([^'"]+)['"]/g,
  /TriggerClientEvent\s*\(\s*['"]([^'"]+)['"]/g,
];

function nodeId(type: DependencyGraphNode["type"], key: string): string {
  return `${type}:${key.replace(/[^a-zA-Z0-9_./@-]+/g, "_")}`;
}

function edgeId(type: DependencyGraphEdge["type"], source: string, target: string): string {
  return `${type}:${source}->${target}`;
}

function upsertNode(nodes: Map<string, DependencyGraphNode>, node: DependencyGraphNode): void {
  nodes.set(node.id, node);
}

function upsertEdge(edges: Map<string, DependencyGraphEdge>, edge: DependencyGraphEdge): void {
  edges.set(edge.id, edge);
}

function resourceTargetId(resourceName: string, knownResources: Set<string>): string {
  if (knownResources.has(resourceName)) {
    return nodeId("resource", resourceName);
  }
  return nodeId("external_resource", resourceName);
}

function collectScriptPaths(resource: Resource): string[] {
  if (resource.manifest.type === "missing") {
    return [];
  }

  return [
    ...resource.manifest.clientScripts,
    ...resource.manifest.serverScripts,
    ...resource.manifest.sharedScripts,
  ].filter((entry) => !isGlobPattern(entry) && !isRemoteUrl(entry));
}

async function scanLuaEvents(
  workspaceRoot: string,
  resource: Resource,
): Promise<Array<{ name: string; kind: "registers_event" | "triggers_event"; file: string }>> {
  const results: Array<{ name: string; kind: "registers_event" | "triggers_event"; file: string }> = [];
  const seen = new Set<string>();

  for (const scriptPath of collectScriptPaths(resource)) {
    if (!/\.(lua|js|c)$/i.test(scriptPath)) {
      continue;
    }

    const absolutePath = path.resolve(workspaceRoot, resource.path, scriptPath);
    if (!existsSync(absolutePath)) {
      continue;
    }

    const source = await readFile(absolutePath, "utf8");
    const relativeFile = `${resource.path}/${scriptPath}`.replace(/\\/g, "/");

    for (const pattern of EVENT_REGISTER_PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of source.matchAll(pattern)) {
        const eventName = match[1];
        if (!eventName) {
          continue;
        }
        const key = `register:${eventName}:${relativeFile}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        results.push({ name: eventName, kind: "registers_event", file: relativeFile });
      }
    }

    for (const pattern of EVENT_TRIGGER_PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of source.matchAll(pattern)) {
        const eventName = match[1];
        if (!eventName) {
          continue;
        }
        const key = `trigger:${eventName}:${relativeFile}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        results.push({ name: eventName, kind: "triggers_event", file: relativeFile });
      }
    }
  }

  return results;
}

export interface BuildDependencyGraphOptions {
  workspaceName: string;
  workspaceRoot: string;
  scanResult: ScanResourcesResult;
}

export async function buildDependencyGraph(options: BuildDependencyGraphOptions): Promise<DependencyGraphReport> {
  const nodes = new Map<string, DependencyGraphNode>();
  const edges = new Map<string, DependencyGraphEdge>();
  const knownResources = new Set(options.scanResult.resources.map((resource) => resource.name));

  upsertNode(nodes, {
    id: nodeId("system", "server_cfg"),
    type: "system",
    label: "server.cfg",
    path: options.scanResult.serverCfg.path,
  });

  for (const resource of options.scanResult.resources) {
    upsertNode(nodes, {
      id: nodeId("resource", resource.name),
      type: "resource",
      label: resource.name,
      resourceName: resource.name,
      path: resource.path,
    });

    if (resource.manifest.type === "missing") {
      continue;
    }

    for (const dependency of resource.manifest.dependencies) {
      const normalized = dependency.startsWith("/") ? dependency.slice(1) : dependency;
      const target = isExternalResourceReference(normalized)
        ? nodeId("external_resource", normalized.slice(1))
        : resourceTargetId(normalized, knownResources);

      if (isExternalResourceReference(normalized)) {
        upsertNode(nodes, {
          id: target,
          type: "external_resource",
          label: normalized.slice(1),
        });
      } else if (!knownResources.has(normalized)) {
        upsertNode(nodes, {
          id: target,
          type: "external_resource",
          label: normalized,
        });
      }

      upsertEdge(edges, {
        id: edgeId("depends_on", nodeId("resource", resource.name), target),
        type: "depends_on",
        source: nodeId("resource", resource.name),
        target,
        resourceName: resource.name,
        details: { dependency: normalized },
      });
    }

    for (const dependency of resource.manifest.runtimeDependencies) {
      const normalized = dependency.startsWith("/") ? dependency.slice(1) : dependency;
      const target = isExternalResourceReference(normalized)
        ? nodeId("external_resource", normalized.slice(1))
        : resourceTargetId(normalized, knownResources);

      if (isExternalResourceReference(normalized)) {
        upsertNode(nodes, {
          id: target,
          type: "external_resource",
          label: normalized.slice(1),
        });
      } else if (!knownResources.has(normalized)) {
        upsertNode(nodes, {
          id: target,
          type: "external_resource",
          label: normalized,
        });
      }

      upsertEdge(edges, {
        id: edgeId("runtime_depends_on", nodeId("resource", resource.name), target),
        type: "runtime_depends_on",
        source: nodeId("resource", resource.name),
        target,
        resourceName: resource.name,
        details: { dependency: normalized },
      });
    }

    for (const referencedPath of collectManifestReferencedPaths(resource.manifest)) {
      if (isRemoteUrl(referencedPath) || isGlobPattern(referencedPath)) {
        continue;
      }

      const fileNodeId = nodeId("file", `${resource.name}/${referencedPath}`);
      upsertNode(nodes, {
        id: fileNodeId,
        type: "file",
        label: referencedPath,
        resourceName: resource.name,
        path: `${resource.path}/${referencedPath}`.replace(/\\/g, "/"),
      });

      upsertEdge(edges, {
        id: edgeId("references_file", nodeId("resource", resource.name), fileNodeId),
        type: "references_file",
        source: nodeId("resource", resource.name),
        target: fileNodeId,
        resourceName: resource.name,
        details: { path: referencedPath },
      });
    }

    const luaEvents = await scanLuaEvents(options.workspaceRoot, resource);
    for (const event of luaEvents) {
      const eventNodeId = nodeId("event", event.name);
      upsertNode(nodes, {
        id: eventNodeId,
        type: "event",
        label: event.name,
        resourceName: resource.name,
      });

      upsertEdge(edges, {
        id: `${event.kind}:${resource.name}:${event.name}:${event.file}`,
        type: event.kind,
        source: nodeId("resource", resource.name),
        target: eventNodeId,
        resourceName: resource.name,
        details: { file: event.file, eventName: event.name },
      });
    }
  }

  for (const resourceName of allStartedResources(options.scanResult.serverCfg)) {
    const target = resourceTargetId(resourceName, knownResources);
    if (!knownResources.has(resourceName)) {
      upsertNode(nodes, {
        id: target,
        type: "external_resource",
        label: resourceName,
      });
    }

    upsertEdge(edges, {
      id: edgeId("started_by_server", nodeId("system", "server_cfg"), target),
      type: "started_by_server",
      source: nodeId("system", "server_cfg"),
      target,
      details: { resourceName },
    });
  }

  const edgeList = [...edges.values()];
  const dependencyEdges = edgeList.filter((edge) => edge.type === "depends_on" || edge.type === "runtime_depends_on").length;
  const fileReferenceEdges = edgeList.filter((edge) => edge.type === "references_file").length;
  const eventEdges = edgeList.filter((edge) => edge.type === "registers_event" || edge.type === "triggers_event").length;

  return DependencyGraphReportSchema.parse({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    workspaceName: options.workspaceName,
    workspaceRoot: options.workspaceRoot,
    summary: {
      resources: options.scanResult.resources.length,
      nodes: nodes.size,
      edges: edgeList.length,
      dependencyEdges,
      fileReferenceEdges,
      eventEdges,
    },
    nodes: [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id)),
    edges: edgeList.sort((a, b) => a.id.localeCompare(b.id)),
  });
}

export async function buildWorkspaceDependencyGraph(
  workspaceRoot: string,
  workspace: Workspace,
): Promise<DependencyGraphReport> {
  const scanResult = await scanResources({ workspaceRoot, workspace });
  return buildDependencyGraph({
    workspaceName: workspace.name,
    workspaceRoot,
    scanResult,
  });
}

export function findGraphEvents(graph: DependencyGraphReport, eventName: string): DependencyGraphEdge[] {
  const normalized = eventName.toLowerCase();
  const eventNodes = new Set(
    graph.nodes.filter((node) => node.type === "event" && node.label.toLowerCase() === normalized).map((node) => node.id),
  );

  return graph.edges.filter((edge) => eventNodes.has(edge.target));
}

export function findImpactedResources(graph: DependencyGraphReport, resourceName: string): DependencyImpactReport {
  const sourceId = nodeId("resource", resourceName);
  const reverseAdjacency = new Map<string, string[]>();

  for (const edge of graph.edges) {
    if (edge.type !== "depends_on" && edge.type !== "runtime_depends_on") {
      continue;
    }

    const dependents = reverseAdjacency.get(edge.target) ?? [];
    dependents.push(edge.source);
    reverseAdjacency.set(edge.target, dependents);
  }

  const direct = [...new Set(reverseAdjacency.get(sourceId) ?? [])]
    .map((id) => id.replace(/^resource:/, ""))
    .filter((name) => name !== resourceName)
    .sort();

  const transitive = new Set<string>();
  const queue = [...direct];

  while (queue.length > 0) {
    const currentName = queue.shift()!;
    if (transitive.has(currentName)) {
      continue;
    }
    transitive.add(currentName);

    const currentId = nodeId("resource", currentName);
    for (const dependentId of reverseAdjacency.get(currentId) ?? []) {
      const dependentName = dependentId.replace(/^resource:/, "");
      if (dependentName !== resourceName && !transitive.has(dependentName)) {
        queue.push(dependentName);
      }
    }
  }

  return DependencyImpactReportSchema.parse({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    resourceName,
    directDependents: direct,
    transitiveDependents: [...transitive].sort(),
  });
}
