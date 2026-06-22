import type { FastifyInstance } from "fastify";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  loadEconomyProfile,
  loadEconomySimulationReport,
  renderEconomyMarkdown,
  FDT_ECONOMY_MARKDOWN,
  FDT_ECONOMY_SIMULATION_REPORT,
  runEconomySimulation,
  saveEconomySimulationReport,
} from "@fdt/core";
import { getActiveWorkspace } from "../workspaces/service.js";

async function requireActiveWorkspace() {
  const active = await getActiveWorkspace();
  if (!active) {
    return null;
  }
  return active;
}

export async function registerEconomyRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/economy/profile", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const profile = await loadEconomyProfile(active.directory);
    return { profile };
  });

  app.post("/api/v1/economy/simulate", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const body = (request.body ?? {}) as { hours?: number };
    const hours = typeof body.hours === "number" && body.hours > 0 ? body.hours : undefined;

    const report = await runEconomySimulation({
      workspaceRoot: active.directory,
      workspaceName: active.workspace.name,
      hours,
    });

    const reportPath = await saveEconomySimulationReport(active.directory, report);
    const markdownPath = path.join(active.directory, FDT_ECONOMY_MARKDOWN);
    await mkdir(path.dirname(markdownPath), { recursive: true });
    await writeFile(markdownPath, renderEconomyMarkdown(report), "utf8");

    return { report, reportPath, markdownPath };
  });

  app.get("/api/v1/reports/economy-simulation", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const reportPath = path.join(active.directory, FDT_ECONOMY_SIMULATION_REPORT);
    if (!existsSync(reportPath)) {
      return reply.status(404).send({ error: "not_found", message: "No economy simulation report found." });
    }

    const report = JSON.parse(await readFile(reportPath, "utf8"));
    return { report, reportPath };
  });

  app.get("/api/v1/reports/economy-simulation/markdown", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    let report = await loadEconomySimulationReport(active.directory);
    if (!report) {
      report = await runEconomySimulation({
        workspaceRoot: active.directory,
        workspaceName: active.workspace.name,
      });
      await saveEconomySimulationReport(active.directory, report);
    }

    return { markdown: renderEconomyMarkdown(report) };
  });
}
