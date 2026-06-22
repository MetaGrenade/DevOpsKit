import type { FastifyInstance } from "fastify";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  buildEnvironmentDiffReport,
  generateServerCfg,
  generateTxAdminRecipe,
  initEnvironmentProfiles,
  listEnvironmentProfiles,
  loadEnvironmentRegistry,
  renderEnvironmentDiffMarkdown,
  resolveProfileForGeneration,
  saveEnvironmentDiffReport,
  saveEnvironmentValidationReport,
  upsertEnvironmentProfile,
  validateEnvironmentProfile,
  FDT_ENVIRONMENT_DIFF_REPORT,
  FDT_ENVIRONMENT_PROFILES_FILE,
  FDT_ENVIRONMENT_VALIDATION_REPORT,
  FDT_TXADMIN_EXPORT_DIR,
} from "@fdt/core";
import {
  CompareEnvironmentInputSchema,
  EnvironmentDiffReportSchema,
  EnvironmentProfileSchema,
  EnvironmentValidationReportSchema,
  GenerateEnvironmentInputSchema,
} from "@fdt/schemas";
import { getActiveWorkspace } from "../workspaces/service.js";

async function requireActiveWorkspace() {
  const active = await getActiveWorkspace();
  if (!active) {
    return null;
  }
  return active;
}

export async function registerEnvironmentRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/environment/profiles", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const registry = await loadEnvironmentRegistry(active.directory);
    const profiles = await listEnvironmentProfiles(active.directory);
    return { defaultProfileId: registry.defaultProfileId, profiles };
  });

  app.post("/api/v1/environment/init", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const registry = await initEnvironmentProfiles(active.directory, active.workspace);
    return { status: "initialized", registry };
  });

  app.put("/api/v1/environment/profiles/:id", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const { id } = request.params as { id: string };
    const parsed = EnvironmentProfileSchema.safeParse({ ...(request.body as object), id });
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_input", message: parsed.error.message });
    }

    const profile = await upsertEnvironmentProfile(active.directory, parsed.data);
    return { status: "saved", profile };
  });

  app.post("/api/v1/environment/generate-cfg", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const parsed = GenerateEnvironmentInputSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_input", message: parsed.error.message });
    }

    const ref = parsed.data.profileId ?? parsed.data.env;
    const profile = await resolveProfileForGeneration(active.directory, ref);
    const result = await generateServerCfg(active.directory, active.workspace, profile);
    return { status: "generated", profileId: profile.id, ...result };
  });

  app.post("/api/v1/environment/generate-recipe", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const parsed = GenerateEnvironmentInputSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_input", message: parsed.error.message });
    }

    const ref = parsed.data.profileId ?? parsed.data.env;
    const profile = await resolveProfileForGeneration(active.directory, ref);
    const result = await generateTxAdminRecipe(active.directory, active.workspace, profile);
    return { status: "generated", profileId: profile.id, ...result };
  });

  app.post("/api/v1/environment/validate", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const parsed = GenerateEnvironmentInputSchema.safeParse(request.body ?? { env: "production" });
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_input", message: parsed.error.message });
    }

    const ref = parsed.data.profileId ?? parsed.data.env ?? "production";
    const profile = await resolveProfileForGeneration(active.directory, ref);
    const report = validateEnvironmentProfile(active.name, profile);
    const reportPath = await saveEnvironmentValidationReport(active.directory, report);
    return { status: report.passed ? "passed" : "failed", report, reportPath };
  });

  app.post("/api/v1/environment/diff", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const parsed = CompareEnvironmentInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_input", message: parsed.error.message });
    }

    const report = await buildEnvironmentDiffReport(
      active.directory,
      active.workspace,
      parsed.data.from,
      parsed.data.to,
    );
    const reportPath = await saveEnvironmentDiffReport(active.directory, report);
    const markdown = renderEnvironmentDiffMarkdown(report);
    return { status: "compared", report, reportPath, markdown };
  });

  app.get("/api/v1/reports/environment-validation", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const reportPath = path.join(active.directory, FDT_ENVIRONMENT_VALIDATION_REPORT);
    if (!existsSync(reportPath)) {
      return reply.status(404).send({
        error: "not_found",
        message: "No environment validation report found.",
      });
    }

    const report = EnvironmentValidationReportSchema.parse(
      JSON.parse(await readFile(reportPath, "utf8")),
    );
    return { report, reportPath };
  });

  app.get("/api/v1/reports/environment-diff", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const reportPath = path.join(active.directory, FDT_ENVIRONMENT_DIFF_REPORT);
    if (!existsSync(reportPath)) {
      return reply.status(404).send({
        error: "not_found",
        message: "No environment diff report found.",
      });
    }

    const report = EnvironmentDiffReportSchema.parse(JSON.parse(await readFile(reportPath, "utf8")));
    return { report, reportPath };
  });

  app.get("/api/v1/environment/exports", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const exportsRoot = path.join(active.directory, FDT_TXADMIN_EXPORT_DIR);
    const profiles = await listEnvironmentProfiles(active.directory);
    const exports = profiles.map((profile) => ({
      profileId: profile.id,
      serverCfgPath: path.join(exportsRoot, profile.id, "server.cfg"),
      recipePath: path.join(exportsRoot, profile.id, "recipe.yaml"),
      serverCfgExists: existsSync(path.join(exportsRoot, profile.id, "server.cfg")),
      recipeExists: existsSync(path.join(exportsRoot, profile.id, "recipe.yaml")),
    }));

    return {
      profilesPath: path.join(active.directory, FDT_ENVIRONMENT_PROFILES_FILE),
      exportsRoot,
      exports,
    };
  });
}
