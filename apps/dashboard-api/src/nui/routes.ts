import type { FastifyInstance } from "fastify";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  discoverNuiResources,
  FDT_NUI_SCHEMA_REPORT,
  syncNuiBridgeSchemas,
  syncWorkspaceNuiSchemas,
  validateWorkspaceNuiSchemas,
} from "@fdt/core";
import { getActiveWorkspace } from "../workspaces/service.js";

async function requireActiveWorkspace() {
  const active = await getActiveWorkspace();
  if (!active) {
    return null;
  }
  return active;
}

export async function registerNuiRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/nui", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const resources = await discoverNuiResources(active.directory, active.workspace.resourcesRoot);
    return { resources };
  });

  app.post("/api/v1/nui/sync", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const body = (request.body ?? {}) as { resource?: string };
    if (body.resource) {
      const resources = await discoverNuiResources(active.directory, active.workspace.resourcesRoot);
      const match = resources.find((entry) => entry.resourceName === body.resource);
      if (!match) {
        return reply.status(404).send({ error: "not_found", message: `NUI resource not found: ${body.resource}` });
      }
      const registry = await syncNuiBridgeSchemas(match.resourceRoot);
      return { status: "synced", resource: body.resource, registry };
    }

    const synced = await syncWorkspaceNuiSchemas({
      workspaceRoot: active.directory,
      resourcesRoot: active.workspace.resourcesRoot,
    });
    return { status: "synced", resources: synced };
  });

  app.post("/api/v1/nui/validate", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const report = await validateWorkspaceNuiSchemas({
      workspaceName: active.workspace.name,
      workspaceRoot: active.directory,
      resourcesRoot: active.workspace.resourcesRoot,
    });

    const reportPath = path.join(active.directory, FDT_NUI_SCHEMA_REPORT);
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    return { report, reportPath, passed: report.summary.errors === 0 };
  });

  app.get("/api/v1/reports/nui-schema-sync", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const reportPath = path.join(active.directory, FDT_NUI_SCHEMA_REPORT);
    if (!existsSync(reportPath)) {
      return reply.status(404).send({ error: "not_found", message: "No NUI schema sync report found." });
    }

    const report = JSON.parse(await readFile(reportPath, "utf8"));
    return { report, reportPath };
  });
}
