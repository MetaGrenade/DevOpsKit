import type { FastifyInstance } from "fastify";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  createClothingPack,
  deleteClothingPack,
  listClothingPacks,
  FDT_CLOTHING_CHANGELOG,
  FDT_CLOTHING_CONFLICTS_REPORT,
  scanClothingPack,
  upsertClothingPack,
} from "@fdt/core";
import { ClothingPackSchema, ClothingValidationReportSchema } from "@fdt/schemas";
import { renderClothingChangelog, validateClothingConflicts } from "@fdt/validators";
import { getActiveWorkspace } from "../workspaces/service.js";

async function requireActiveWorkspace() {
  const active = await getActiveWorkspace();
  if (!active) {
    return null;
  }
  return active;
}

export async function registerClothingRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/clothing/packs", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const packs = await listClothingPacks(active.directory);
    return { packs };
  });

  app.post("/api/v1/clothing/packs", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const parsed = ClothingPackSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_input", message: parsed.error.message });
    }

    const pack = await upsertClothingPack(active.directory, parsed.data);
    return { status: "saved", pack };
  });

  app.post("/api/v1/clothing/packs/new", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const body = request.body as {
      id?: string;
      label?: string;
      resourceName?: string;
      resourcePath?: string;
      genderScope?: string;
    };

    if (!body.id || !body.label || !body.resourceName) {
      return reply.status(400).send({
        error: "invalid_input",
        message: "id, label, and resourceName are required",
      });
    }

    const pack = await createClothingPack(active.directory, {
      id: body.id,
      label: body.label,
      resourceName: body.resourceName,
      resourcePath: body.resourcePath,
      genderScope: body.genderScope as "male" | "female" | "shared" | undefined,
    });

    return { status: "created", pack };
  });

  app.delete("/api/v1/clothing/packs/:id", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const { id } = request.params as { id: string };
    const removed = await deleteClothingPack(active.directory, id);
    if (!removed) {
      return reply.status(404).send({ error: "not_found", message: `Clothing pack not found: ${id}` });
    }

    return { status: "removed", id };
  });

  app.post("/api/v1/clothing/scan", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const body = (request.body ?? {}) as { packId?: string };
    let packs = await listClothingPacks(active.directory);
    if (body.packId) {
      packs = packs.filter((pack) => pack.id === body.packId);
    }

    if (packs.length === 0) {
      return reply.status(404).send({ error: "not_found", message: "No clothing packs found to scan" });
    }

    const results = [];
    for (const pack of packs) {
      const result = await scanClothingPack({ workspaceRoot: active.directory, pack });
      await upsertClothingPack(active.directory, result.pack);
      results.push(result);
    }

    return { status: "scanned", results };
  });

  app.post("/api/v1/clothing/conflicts", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const packs = await listClothingPacks(active.directory);
    const report = validateClothingConflicts({
      workspaceName: active.name,
      workspaceRoot: active.directory,
      packs,
    });

    const reportPath = path.join(active.directory, FDT_CLOTHING_CONFLICTS_REPORT);
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    return { status: "validated", report, reportPath };
  });

  app.get("/api/v1/reports/clothing-conflicts", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const reportPath = path.join(active.directory, FDT_CLOTHING_CONFLICTS_REPORT);
    if (!existsSync(reportPath)) {
      return reply.status(404).send({
        error: "not_found",
        message:
          "No clothing conflict report found. Run `pnpm fdt clothing conflicts --workspace <path>` then refresh.",
        hint: "Reports are written to <workspace>/.fdt/reports/clothing-conflicts.json",
      });
    }

    const report = ClothingValidationReportSchema.parse(
      JSON.parse(await readFile(reportPath, "utf8")),
    );
    return { report, reportPath };
  });

  app.get("/api/v1/reports/clothing-changelog", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const packs = await listClothingPacks(active.directory);
    const markdown = renderClothingChangelog(packs);
    const markdownPath = path.join(active.directory, FDT_CLOTHING_CHANGELOG);
    return { markdown, markdownPath, packCount: packs.length };
  });
}
