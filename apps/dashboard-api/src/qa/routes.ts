import type { FastifyInstance } from "fastify";
import {
  attachQaRunToRelease,
  createQaRun,
  deleteQaScenario,
  getQaRun,
  importQaRunExport,
  listQaRuns,
  listQaScenarios,
  summarizeQaForRelease,
  updateQaRunStep,
  upsertQaScenario,
} from "@fdt/core";
import {
  AttachQaRunInputSchema,
  CreateQaRunInputSchema,
  QaRunExportSchema,
  QaScenarioSchema,
  UpdateQaRunStepInputSchema,
} from "@fdt/schemas";
import { getActiveWorkspace } from "../workspaces/service.js";

async function requireActiveWorkspace() {
  const active = await getActiveWorkspace();
  if (!active) {
    return null;
  }
  return active;
}

export async function registerQaRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/qa/scenarios", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const scenarios = await listQaScenarios(active.directory);
    return { scenarios };
  });

  app.post("/api/v1/qa/scenarios", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const parsed = QaScenarioSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_input", message: parsed.error.message });
    }

    const scenario = await upsertQaScenario(active.directory, parsed.data);
    return { status: "saved", scenario };
  });

  app.delete("/api/v1/qa/scenarios/:id", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const { id } = request.params as { id: string };
    const removed = await deleteQaScenario(active.directory, id);
    if (!removed) {
      return reply.status(404).send({ error: "not_found", message: `Scenario not found: ${id}` });
    }

    return { status: "removed", id };
  });

  app.get("/api/v1/qa/runs", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const runs = await listQaRuns(active.directory);
    return { runs };
  });

  app.get("/api/v1/qa/runs/:id", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const { id } = request.params as { id: string };
    const run = await getQaRun(active.directory, id);
    if (!run) {
      return reply.status(404).send({ error: "not_found", message: `QA run not found: ${id}` });
    }

    return { run };
  });

  app.post("/api/v1/qa/runs", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const parsed = CreateQaRunInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_input", message: parsed.error.message });
    }

    try {
      const run = await createQaRun(active.directory, parsed.data);
      return { status: "created", run };
    } catch (error) {
      return reply.status(400).send({
        error: "create_failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.patch("/api/v1/qa/runs/:id/steps", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const parsed = UpdateQaRunStepInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_input", message: parsed.error.message });
    }

    const { id } = request.params as { id: string };

    try {
      const run = await updateQaRunStep(active.directory, id, parsed.data.stepId, {
        status: parsed.data.status,
        note: parsed.data.note,
      });
      return { status: "updated", run };
    } catch (error) {
      return reply.status(404).send({
        error: "not_found",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.patch("/api/v1/qa/runs/:id/release", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const parsed = AttachQaRunInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_input", message: parsed.error.message });
    }

    const { id } = request.params as { id: string };

    try {
      const run = await attachQaRunToRelease(active.directory, id, parsed.data);
      return { status: "attached", run };
    } catch (error) {
      return reply.status(404).send({
        error: "not_found",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post("/api/v1/qa/runs/import", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const parsed = QaRunExportSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_input", message: parsed.error.message });
    }

    const run = await importQaRunExport(active.directory, parsed.data);
    return { status: "imported", run };
  });

  app.get("/api/v1/releases/:id/qa", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const { id } = request.params as { id: string };
    const summary = await summarizeQaForRelease(active.directory, id);
    const runs = await listQaRuns(active.directory);
    const releaseRuns = runs.filter((run) => run.releaseId === id || run.releaseVersion === id);

    return { summary, runs: releaseRuns };
  });
}
