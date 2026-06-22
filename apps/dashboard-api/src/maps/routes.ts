import type { FastifyInstance } from "fastify";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  createMapPackage,
  listMapPackages,
  refreshMapChecklist,
  deriveMapIdFromResourceName,
  FDT_MAP_AUDIT_REPORT,
  FDT_MAP_TEST_POINTS,
  scanWorkspaceMaps,
  syncMapRegistryFromScan,
  upsertMapPackage,
  writeMapResource,
} from "@fdt/core";
import { MapPackageSchema } from "@fdt/schemas";
import { renderMapTestPoints, renderWorkspaceMapTestPoints, validateMaps } from "@fdt/validators";
import { getActiveWorkspace } from "../workspaces/service.js";

async function requireActiveWorkspace() {
  const active = await getActiveWorkspace();
  if (!active) {
    return null;
  }
  return active;
}

export async function registerMapRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/maps", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const maps = await listMapPackages(active.directory);
    return { maps };
  });

  app.post("/api/v1/maps", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const parsed = MapPackageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_input", message: parsed.error.message });
    }

    const mapPackage = await upsertMapPackage(active.directory, parsed.data);
    return { status: "saved", map: mapPackage };
  });

  app.post("/api/v1/maps/new", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const body = request.body as { resourceName?: string; label?: string; id?: string; force?: boolean };
    if (!body.resourceName) {
      return reply.status(400).send({ error: "invalid_input", message: "resourceName is required" });
    }

    const resourceRoot = await writeMapResource({
      workspaceRoot: active.directory,
      resourcesRoot: active.workspace.resourcesRoot,
      resourceName: body.resourceName,
      label: body.label,
      mapId: body.id,
      force: body.force === true,
    });

    const mapId = body.id ?? deriveMapIdFromResourceName(body.resourceName);
    const label = body.label ?? body.resourceName.replace(/_/g, " ");
    const resourcePath = path.relative(active.directory, resourceRoot).replace(/\\/g, "/");

    await createMapPackage(active.directory, {
      id: mapId,
      label,
      resourceName: body.resourceName,
      resourcePath,
    });

    const scanned = await scanWorkspaceMaps({
      workspaceRoot: active.directory,
      resourcesRoot: active.workspace.resourcesRoot,
      discover: false,
      resourceName: body.resourceName,
    });

    const mapPackage = scanned[0]
      ? await syncMapRegistryFromScan(active.directory, scanned[0], mapId)
      : (await listMapPackages(active.directory)).find((entry) => entry.id === mapId);

    return { status: "created", map: mapPackage };
  });

  app.post("/api/v1/maps/scan", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const body = (request.body ?? {}) as { resource?: string };
    const scanned = await scanWorkspaceMaps({
      workspaceRoot: active.directory,
      resourcesRoot: active.workspace.resourcesRoot,
      discover: true,
      resourceName: body.resource,
    });

    return {
      resourcesScanned: scanned.length,
      streamFiles: scanned.reduce((sum, item) => sum + item.streamFileCount, 0),
      scanned,
    };
  });

  app.post("/api/v1/maps/audit", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const body = (request.body ?? {}) as { resource?: string };
    const scanned = await scanWorkspaceMaps({
      workspaceRoot: active.directory,
      resourcesRoot: active.workspace.resourcesRoot,
      discover: true,
      resourceName: body.resource,
    });

    for (const scan of scanned) {
      await syncMapRegistryFromScan(active.directory, scan);
    }

    const maps = await listMapPackages(active.directory);
    const report = validateMaps({
      workspaceName: active.workspace.name,
      workspaceRoot: active.directory,
      maps,
      scanned,
    });

    const reportPath = path.join(active.directory, FDT_MAP_AUDIT_REPORT);
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    return { report, reportPath, passed: report.summary.errors === 0 };
  });

  app.post("/api/v1/maps/:id/checklist", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const { id } = request.params as { id: string };
    const maps = await listMapPackages(active.directory);
    const current = maps.find((entry) => entry.id === id);
    if (!current) {
      return reply.status(404).send({ error: "not_found", message: `Map package not found: ${id}` });
    }

    const scanned = await scanWorkspaceMaps({
      workspaceRoot: active.directory,
      resourcesRoot: active.workspace.resourcesRoot,
      discover: false,
      resourceName: current.resourceName,
    });
    if (scanned[0]) {
      await syncMapRegistryFromScan(active.directory, scanned[0], id);
    }

    const mapPackage = await refreshMapChecklist(active.directory, id);
    return { status: "updated", map: mapPackage };
  });

  app.post("/api/v1/maps/export-test-points", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const body = (request.body ?? {}) as { id?: string };
    const maps = await listMapPackages(active.directory);
    const selected = body.id ? maps.filter((entry) => entry.id === body.id) : maps;

    if (selected.length === 0) {
      return reply.status(404).send({ error: "not_found", message: "No map packages found to export" });
    }

    const workspaceExport = renderWorkspaceMapTestPoints(active.workspace.name, selected);
    const reportPath = path.join(active.directory, FDT_MAP_TEST_POINTS);
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(workspaceExport, null, 2)}\n`, "utf8");

    return { export: workspaceExport, reportPath, maps: selected.map((mapPackage) => renderMapTestPoints(mapPackage)) };
  });

  app.get("/api/v1/reports/map-audit", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const reportPath = path.join(active.directory, FDT_MAP_AUDIT_REPORT);
    if (!existsSync(reportPath)) {
      return reply.status(404).send({ error: "not_found", message: "No map audit report found." });
    }

    const report = JSON.parse(await readFile(reportPath, "utf8"));
    return { report, reportPath };
  });
}
