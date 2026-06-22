import type { FastifyInstance } from "fastify";
import { deleteZone, importZoneExport, listZones, upsertZone } from "@fdt/core";
import { ZoneExportSchema, ZoneSchema } from "@fdt/schemas";
import { getActiveWorkspace } from "../workspaces/service.js";

async function requireActiveWorkspace() {
  const active = await getActiveWorkspace();
  if (!active) {
    return null;
  }
  return active;
}

export async function registerZoneRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/zones", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    const zones = await listZones(active.directory);
    return { zones };
  });

  app.post("/api/v1/zones", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    const parsed = ZoneSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_input",
        message: parsed.error.message,
      });
    }

    const zone = await upsertZone(active.directory, parsed.data);
    return { status: "saved", zone };
  });

  app.delete("/api/v1/zones/:id", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    const { id } = request.params as { id: string };
    const removed = await deleteZone(active.directory, id);
    if (!removed) {
      return reply.status(404).send({
        error: "not_found",
        message: `Zone not found: ${id}`,
      });
    }

    return { status: "removed", id };
  });

  app.post("/api/v1/zones/import", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    const parsed = ZoneExportSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_input",
        message: parsed.error.message,
      });
    }

    const result = await importZoneExport(active.directory, parsed.data);
    return {
      status: "imported",
      imported: result.imported,
      zones: result.zones,
    };
  });
}
