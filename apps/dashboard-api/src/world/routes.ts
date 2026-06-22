import type { FastifyInstance } from "fastify";
import {
  deleteBlip,
  deleteDoor,
  deleteProp,
  importWorldExport,
  listBlips,
  listDoors,
  listProps,
  upsertBlip,
  upsertDoor,
  upsertProp,
} from "@fdt/core";
import { BlipSchema, DoorSchema, PropPlacementSchema, WorldExportSchema } from "@fdt/schemas";
import { getActiveWorkspace } from "../workspaces/service.js";

async function requireActiveWorkspace() {
  const active = await getActiveWorkspace();
  if (!active) {
    return null;
  }
  return active;
}

export async function registerWorldRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/world/blips", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }
    return { blips: await listBlips(active.directory) };
  });

  app.get("/api/v1/world/props", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }
    return { props: await listProps(active.directory) };
  });

  app.get("/api/v1/world/doors", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }
    return { doors: await listDoors(active.directory) };
  });

  app.post("/api/v1/world/blips", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }
    const parsed = BlipSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_input", message: parsed.error.message });
    }
    const blip = await upsertBlip(active.directory, parsed.data);
    return { status: "saved", blip };
  });

  app.post("/api/v1/world/props", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }
    const parsed = PropPlacementSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_input", message: parsed.error.message });
    }
    const prop = await upsertProp(active.directory, parsed.data);
    return { status: "saved", prop };
  });

  app.post("/api/v1/world/doors", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }
    const parsed = DoorSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_input", message: parsed.error.message });
    }
    const door = await upsertDoor(active.directory, parsed.data);
    return { status: "saved", door };
  });

  app.delete("/api/v1/world/blips/:id", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }
    const { id } = request.params as { id: string };
    const removed = await deleteBlip(active.directory, id);
    if (!removed) {
      return reply.status(404).send({ error: "not_found", message: `Blip not found: ${id}` });
    }
    return { status: "removed", id };
  });

  app.delete("/api/v1/world/props/:id", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }
    const { id } = request.params as { id: string };
    const removed = await deleteProp(active.directory, id);
    if (!removed) {
      return reply.status(404).send({ error: "not_found", message: `Prop not found: ${id}` });
    }
    return { status: "removed", id };
  });

  app.delete("/api/v1/world/doors/:id", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }
    const { id } = request.params as { id: string };
    const removed = await deleteDoor(active.directory, id);
    if (!removed) {
      return reply.status(404).send({ error: "not_found", message: `Door not found: ${id}` });
    }
    return { status: "removed", id };
  });

  app.post("/api/v1/world/import", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const parsed = WorldExportSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_input", message: parsed.error.message });
    }

    const result = await importWorldExport(active.directory, parsed.data);
    return { status: "imported", ...result };
  });
}
