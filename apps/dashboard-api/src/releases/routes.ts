import type { FastifyInstance } from "fastify";
import {
  buildReleaseChecklist,
  buildReleaseDiffReport,
  createRelease,
  exportReleaseBundle,
  getRelease,
  listReleases,
  renderReleaseChecklistMarkdown,
  renderReleaseDiffMarkdown,
  saveReleaseChecklistReport,
  saveReleaseDiffReport,
  updateReleaseStatus,
} from "@fdt/core";
import {
  CreateReleaseInputSchema,
  ExportReleaseBundleInputSchema,
  UpdateReleaseStatusInputSchema,
} from "@fdt/schemas";
import { getActiveWorkspace } from "../workspaces/service.js";

async function requireActiveWorkspace() {
  const active = await getActiveWorkspace();
  if (!active) {
    return null;
  }
  return active;
}

export async function registerReleaseRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/releases", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    const releases = await listReleases(active.directory);
    return { releases };
  });

  app.get("/api/v1/releases/diff", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    const { from, to } = request.query as { from?: string; to?: string };
    if (!from || !to) {
      return reply.status(400).send({
        error: "invalid_input",
        message: "Query parameters 'from' and 'to' are required.",
      });
    }

    try {
      const report = await buildReleaseDiffReport(active.directory, from, to);
      const reportPath = await saveReleaseDiffReport(active.directory, report);
      return {
        report,
        reportPath,
        markdown: renderReleaseDiffMarkdown(report),
      };
    } catch (error) {
      return reply.status(404).send({
        error: "not_found",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get("/api/v1/releases/:id", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    const { id } = request.params as { id: string };
    const release = await getRelease(active.directory, id);
    if (!release) {
      return reply.status(404).send({
        error: "not_found",
        message: `Release not found: ${id}`,
      });
    }

    return { release };
  });

  app.post("/api/v1/releases", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    const parsed = CreateReleaseInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_input",
        message: parsed.error.message,
      });
    }

    try {
      const release = await createRelease({
        workspaceRoot: active.directory,
        workspace: active.workspace,
        input: parsed.data,
      });
      return { status: "created", release };
    } catch (error) {
      return reply.status(400).send({
        error: "create_failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.patch("/api/v1/releases/:id/status", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    const parsed = UpdateReleaseStatusInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_input",
        message: parsed.error.message,
      });
    }

    const { id } = request.params as { id: string };

    try {
      const release = await updateReleaseStatus(active.directory, id, parsed.data);
      return { status: "updated", release };
    } catch (error) {
      return reply.status(404).send({
        error: "not_found",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get("/api/v1/releases/:id/checklist", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    const { id } = request.params as { id: string };

    try {
      const report = await buildReleaseChecklist(active.directory, id);
      const reportPath = await saveReleaseChecklistReport(active.directory, report);
      return {
        report,
        reportPath,
        markdown: renderReleaseChecklistMarkdown(report),
      };
    } catch (error) {
      return reply.status(404).send({
        error: "not_found",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post("/api/v1/releases/:id/bundle", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    const parsed = ExportReleaseBundleInputSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_input",
        message: parsed.error.message,
      });
    }

    const { id } = request.params as { id: string };
    const release = await getRelease(active.directory, id);
    if (!release) {
      return reply.status(404).send({
        error: "not_found",
        message: `Release not found: ${id}`,
      });
    }

    const outputDir = parsed.data.outputDir ?? `.fdt/exports/releases/${release.version}`;

    try {
      const result = await exportReleaseBundle({
        workspaceRoot: active.directory,
        releaseVersion: release.version,
        outputDir,
      });
      return { status: "exported", ...result };
    } catch (error) {
      return reply.status(400).send({
        error: "export_failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
