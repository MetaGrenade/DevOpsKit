import type { FastifyInstance } from "fastify";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  compareHandlingMetrics,
  listVehicles,
  loadHandlingMetricsForSpawn,
  FDT_VEHICLE_AUDIT_REPORT,
  FDT_VEHICLE_SPAWN_TESTS,
  scanWorkspaceVehicles,
  upsertVehicle,
} from "@fdt/core";
import { VehicleHandlingComparisonSchema, VehicleSchema } from "@fdt/schemas";
import { renderVehicleSpawnTests, validateVehicles } from "@fdt/validators";
import { getActiveWorkspace } from "../workspaces/service.js";

async function requireActiveWorkspace() {
  const active = await getActiveWorkspace();
  if (!active) {
    return null;
  }
  return active;
}

export async function registerVehicleRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/vehicles", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const vehicles = await listVehicles(active.directory);
    return { vehicles };
  });

  app.post("/api/v1/vehicles", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const parsed = VehicleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_input", message: parsed.error.message });
    }

    const vehicle = await upsertVehicle(active.directory, parsed.data);
    return { status: "saved", vehicle };
  });

  app.post("/api/v1/vehicles/scan", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const body = (request.body ?? {}) as { resource?: string };
    const scanned = await scanWorkspaceVehicles({
      workspaceRoot: active.directory,
      resourcesRoot: active.workspace.resourcesRoot,
      discover: true,
      resourceName: body.resource,
    });

    return {
      resourcesScanned: scanned.length,
      vehiclesIndexed: scanned.reduce((sum, item) => sum + item.vehicles.length, 0),
      scanned,
    };
  });

  app.post("/api/v1/vehicles/audit", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const scanned = await scanWorkspaceVehicles({
      workspaceRoot: active.directory,
      resourcesRoot: active.workspace.resourcesRoot,
      discover: true,
    });
    const vehicles = await listVehicles(active.directory);
    const report = validateVehicles({
      workspaceName: active.workspace.name,
      workspaceRoot: active.directory,
      vehicles,
      scanned: scanned.map((item) => ({
        resourceName: item.resourceName,
        spawnNames: item.spawnNames,
        files: item.files,
      })),
    });

    const reportPath = path.join(active.directory, FDT_VEHICLE_AUDIT_REPORT);
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    return { report, reportPath, passed: report.summary.errors === 0 };
  });

  app.post("/api/v1/vehicles/compare-handling", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const body = request.body as { baseline?: string; target?: string };
    if (!body.baseline || !body.target) {
      return reply.status(400).send({ error: "invalid_input", message: "baseline and target are required" });
    }

    const baseline = await loadHandlingMetricsForSpawn(
      active.directory,
      active.workspace.resourcesRoot,
      body.baseline.toLowerCase(),
    );
    const target = await loadHandlingMetricsForSpawn(
      active.directory,
      active.workspace.resourcesRoot,
      body.target.toLowerCase(),
    );

    if (!baseline || !target) {
      return reply.status(404).send({
        error: "not_found",
        message: "Could not load handling.meta metrics for both spawn names",
      });
    }

    const { deltas, notes } = compareHandlingMetrics(baseline, target);
    const comparison = VehicleHandlingComparisonSchema.parse({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      baseline,
      target,
      deltas,
      notes,
    });

    return { comparison };
  });

  app.post("/api/v1/vehicles/test-list", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const vehicles = await listVehicles(active.directory);
    const tests = renderVehicleSpawnTests(active.workspace.name, vehicles);
    const reportPath = path.join(active.directory, FDT_VEHICLE_SPAWN_TESTS);
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(tests, null, 2)}\n`, "utf8");

    return { tests, reportPath };
  });

  app.get("/api/v1/reports/vehicle-audit", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const reportPath = path.join(active.directory, FDT_VEHICLE_AUDIT_REPORT);
    if (!existsSync(reportPath)) {
      return reply.status(404).send({ error: "not_found", message: "No vehicle audit report found." });
    }

    const report = JSON.parse(await readFile(reportPath, "utf8"));
    return { report, reportPath };
  });
}
