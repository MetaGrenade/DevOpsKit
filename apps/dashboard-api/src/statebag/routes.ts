import type { FastifyInstance } from "fastify";
import { importStateBagExport, listStateBagSnapshots } from "@fdt/core";
import { StateBagExportSchema } from "@fdt/schemas";
import { getActiveWorkspace } from "../workspaces/service.js";

async function requireActiveWorkspace() {
  const active = await getActiveWorkspace();
  if (!active) {
    return null;
  }
  return active;
}

export async function registerStateBagRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/statebag/snapshots", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const snapshots = await listStateBagSnapshots(active.directory);
    return { snapshots };
  });

  app.post("/api/v1/statebag/import", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const parsed = StateBagExportSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_input", message: parsed.error.message });
    }

    const result = await importStateBagExport(active.directory, parsed.data);
    return { status: "imported", imported: result.imported, snapshots: result.snapshots };
  });
}
