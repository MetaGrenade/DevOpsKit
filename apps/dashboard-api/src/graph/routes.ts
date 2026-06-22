import type { FastifyInstance } from "fastify";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  buildWorkspaceDependencyGraph,
  findGraphEvents,
  findImpactedResources,
  FDT_DEPENDENCY_GRAPH,
  renderDependencyGraphDot,
  renderDependencyGraphHtml,
} from "@fdt/core";
import { getActiveWorkspace } from "../workspaces/service.js";

async function requireActiveWorkspace() {
  const active = await getActiveWorkspace();
  if (!active) {
    return null;
  }
  return active;
}

export async function registerGraphRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/v1/graph/build", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const report = await buildWorkspaceDependencyGraph(active.directory, active.workspace);

    const reportPath = path.join(active.directory, FDT_DEPENDENCY_GRAPH);
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    return { report, reportPath };
  });

  app.get("/api/v1/graph", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const reportPath = path.join(active.directory, FDT_DEPENDENCY_GRAPH);
    if (!existsSync(reportPath)) {
      return reply.status(404).send({ error: "not_found", message: "No dependency graph report found." });
    }

    const report = JSON.parse(await readFile(reportPath, "utf8"));
    return { report, reportPath };
  });

  app.get("/api/v1/graph/impacted", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const query = request.query as { resource?: string };
    if (!query.resource) {
      return reply.status(400).send({ error: "invalid_input", message: "resource query parameter is required" });
    }

    const reportPath = path.join(active.directory, FDT_DEPENDENCY_GRAPH);
    let report;
    if (existsSync(reportPath)) {
      report = JSON.parse(await readFile(reportPath, "utf8"));
    } else {
      report = await buildWorkspaceDependencyGraph(active.directory, active.workspace);
    }

    const impact = findImpactedResources(report, query.resource);
    return { impact };
  });

  app.get("/api/v1/graph/events/:eventName", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const { eventName } = request.params as { eventName: string };
    const reportPath = path.join(active.directory, FDT_DEPENDENCY_GRAPH);
    let report;
    if (existsSync(reportPath)) {
      report = JSON.parse(await readFile(reportPath, "utf8"));
    } else {
      report = await buildWorkspaceDependencyGraph(active.directory, active.workspace);
    }

    const matches = findGraphEvents(report, decodeURIComponent(eventName));
    return { eventName, matches };
  });

  app.post("/api/v1/graph/export", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const body = (request.body ?? {}) as { format?: string };
    const format = (body.format ?? "json").toLowerCase();
    const reportPath = path.join(active.directory, FDT_DEPENDENCY_GRAPH);
    if (!existsSync(reportPath)) {
      return reply.status(404).send({ error: "not_found", message: "No dependency graph report found." });
    }

    const report = JSON.parse(await readFile(reportPath, "utf8"));
    let output = `${JSON.stringify(report, null, 2)}\n`;
    let extension = "json";

    if (format === "dot") {
      output = renderDependencyGraphDot(report);
      extension = "dot";
    } else if (format === "html") {
      output = renderDependencyGraphHtml(report);
      extension = "html";
    }

    const exportPath = path.join(active.directory, `.fdt/exports/dependency-graph.${extension}`);
    await mkdir(path.dirname(exportPath), { recursive: true });
    await writeFile(exportPath, output, "utf8");

    return { format, exportPath };
  });

  app.get("/api/v1/reports/dependency-graph", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const reportPath = path.join(active.directory, FDT_DEPENDENCY_GRAPH);
    if (!existsSync(reportPath)) {
      return reply.status(404).send({ error: "not_found", message: "No dependency graph report found." });
    }

    const report = JSON.parse(await readFile(reportPath, "utf8"));
    return { report, reportPath };
  });
}
