import type { FastifyInstance } from "fastify";
import { getAdapter, getRecommendedAdapterId, listAdapters } from "@fdt/adapters";
import {
  createBusinessFromZone,
  createGangFromZone,
  createJobFromZone,
  createMapPackage,
  deleteBusiness,
  deleteGang,
  deleteJob,
  deleteMapPackage,
  deleteVehicle,
  listBusinesses,
  listGangs,
  listJobs,
  listMapPackages,
  listVehicles,
  loadDomainModel,
  refreshMapChecklist,
  upsertBusiness,
  upsertGang,
  upsertJob,
  upsertMapPackage,
  upsertVehicle,
} from "@fdt/core";
import {
  AdapterIdSchema,
  BusinessSchema,
  GangSchema,
  JobSchema,
  MapPackageSchema,
  VehicleSchema,
} from "@fdt/schemas";
import { getActiveWorkspace } from "../workspaces/service.js";

async function requireActiveWorkspace() {
  const active = await getActiveWorkspace();
  if (!active) {
    return null;
  }
  return active;
}

export async function registerDomainRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/domains/vehicles", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }
    const vehicles = await listVehicles(active.directory);
    return { vehicles };
  });

  app.post("/api/v1/domains/vehicles", async (request, reply) => {
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

  app.delete("/api/v1/domains/vehicles/:spawnName", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const { spawnName } = request.params as { spawnName: string };
    const removed = await deleteVehicle(active.directory, spawnName);
    if (!removed) {
      return reply.status(404).send({ error: "not_found", message: `Vehicle not found: ${spawnName}` });
    }

    return { status: "removed", spawnName };
  });

  app.get("/api/v1/domains/businesses", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }
    const businesses = await listBusinesses(active.directory);
    return { businesses };
  });

  app.post("/api/v1/domains/businesses", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const parsed = BusinessSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_input", message: parsed.error.message });
    }

    const business = await upsertBusiness(active.directory, parsed.data);
    return { status: "saved", business };
  });

  app.post("/api/v1/domains/businesses/from-zone", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const body = request.body as { zoneId?: string; id?: string; label?: string };
    if (!body.zoneId) {
      return reply.status(400).send({ error: "invalid_input", message: "zoneId is required" });
    }

    try {
      const business = await createBusinessFromZone(active.directory, {
        zoneId: body.zoneId,
        id: body.id,
        label: body.label,
      });
      return { status: "created", business };
    } catch (error) {
      return reply.status(404).send({
        error: "not_found",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.delete("/api/v1/domains/businesses/:id", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const { id } = request.params as { id: string };
    const removed = await deleteBusiness(active.directory, id);
    if (!removed) {
      return reply.status(404).send({ error: "not_found", message: `Business not found: ${id}` });
    }

    return { status: "removed", id };
  });

  app.get("/api/v1/domains/jobs", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }
    const jobs = await listJobs(active.directory);
    return { jobs };
  });

  app.post("/api/v1/domains/jobs", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const parsed = JobSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_input", message: parsed.error.message });
    }

    const job = await upsertJob(active.directory, parsed.data);
    return { status: "saved", job };
  });

  app.post("/api/v1/domains/jobs/from-zone", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const body = request.body as { zoneId?: string; id?: string; label?: string };
    if (!body.zoneId) {
      return reply.status(400).send({ error: "invalid_input", message: "zoneId is required" });
    }

    try {
      const job = await createJobFromZone(active.directory, body as { zoneId: string; id?: string; label?: string });
      return { status: "created", job };
    } catch (error) {
      return reply.status(404).send({
        error: "not_found",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.delete("/api/v1/domains/jobs/:id", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const { id } = request.params as { id: string };
    const removed = await deleteJob(active.directory, id);
    if (!removed) {
      return reply.status(404).send({ error: "not_found", message: `Job not found: ${id}` });
    }

    return { status: "removed", id };
  });

  app.get("/api/v1/domains/gangs", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }
    const gangs = await listGangs(active.directory);
    return { gangs };
  });

  app.post("/api/v1/domains/gangs", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const parsed = GangSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_input", message: parsed.error.message });
    }

    const gang = await upsertGang(active.directory, parsed.data);
    return { status: "saved", gang };
  });

  app.post("/api/v1/domains/gangs/from-zone", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const body = request.body as { zoneId?: string; id?: string; label?: string };
    if (!body.zoneId) {
      return reply.status(400).send({ error: "invalid_input", message: "zoneId is required" });
    }

    try {
      const gang = await createGangFromZone(active.directory, body as { zoneId: string; id?: string; label?: string });
      return { status: "created", gang };
    } catch (error) {
      return reply.status(404).send({
        error: "not_found",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.delete("/api/v1/domains/gangs/:id", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const { id } = request.params as { id: string };
    const removed = await deleteGang(active.directory, id);
    if (!removed) {
      return reply.status(404).send({ error: "not_found", message: `Gang not found: ${id}` });
    }

    return { status: "removed", id };
  });

  app.get("/api/v1/domains/maps", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }
    const maps = await listMapPackages(active.directory);
    return { maps };
  });

  app.post("/api/v1/domains/maps", async (request, reply) => {
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

  app.post("/api/v1/domains/maps/new", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const body = request.body as {
      id?: string;
      label?: string;
      resourceName?: string;
      resourcePath?: string;
    };

    if (!body.id || !body.label || !body.resourceName) {
      return reply.status(400).send({
        error: "invalid_input",
        message: "id, label, and resourceName are required",
      });
    }

    const mapPackage = await createMapPackage(active.directory, {
      id: body.id,
      label: body.label,
      resourceName: body.resourceName,
      resourcePath: body.resourcePath,
    });

    return { status: "created", map: mapPackage };
  });

  app.post("/api/v1/domains/maps/:id/checklist", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const { id } = request.params as { id: string };

    try {
      const mapPackage = await refreshMapChecklist(active.directory, id);
      return { status: "updated", map: mapPackage };
    } catch (error) {
      return reply.status(404).send({
        error: "not_found",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.delete("/api/v1/domains/maps/:id", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const { id } = request.params as { id: string };
    const removed = await deleteMapPackage(active.directory, id);
    if (!removed) {
      return reply.status(404).send({ error: "not_found", message: `Map package not found: ${id}` });
    }

    return { status: "removed", id };
  });

  app.post("/api/v1/domains/export", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const body = (request.body ?? {}) as { adapter?: string; dryRun?: boolean };
    const adapterId = AdapterIdSchema.parse(body.adapter ?? "custom-json");
    const adapter = getAdapter(adapterId);
    const model = await loadDomainModel(active.directory);
    const result = await adapter.export(model, { dryRun: body.dryRun ?? true });

    return {
      adapterId,
      dryRun: body.dryRun ?? true,
      recommendedAdapter: getRecommendedAdapterId(active.frameworkProfile?.recommendedAdapters ?? ["custom-json"]),
      adapters: listAdapters().map((entry) => ({
        id: entry.id,
        label: entry.label,
        capabilities: entry.capabilities,
      })),
      files: result.files,
    };
  });
}
