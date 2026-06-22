import type { FastifyInstance } from "fastify";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  attachPerformanceSnapshotToRelease,
  comparePerformanceSnapshots,
  importPerformanceSnapshot,
  listPerformanceSnapshots,
  loadPerformanceComparisonReport,
  renderPerformanceMarkdown,
  resolvePerformanceSnapshotRef,
  FDT_PERFORMANCE_COMPARISON_REPORT,
  FDT_PERFORMANCE_MARKDOWN,
  savePerformanceComparisonReport,
  summarizePerformanceForRelease,
} from "@fdt/core";
import {
  AttachPerformanceSnapshotInputSchema,
  ComparePerformanceInputSchema,
  PerformanceComparisonReportSchema,
  PerformanceSnapshotImportSchema,
} from "@fdt/schemas";
import { getActiveWorkspace } from "../workspaces/service.js";

async function requireActiveWorkspace() {
  const active = await getActiveWorkspace();
  if (!active) {
    return null;
  }
  return active;
}

export async function registerPerformanceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/performance/snapshots", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const snapshots = await listPerformanceSnapshots(active.directory);
    return { snapshots };
  });

  app.post("/api/v1/performance/snapshots/import", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const parsed = PerformanceSnapshotImportSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_input", message: parsed.error.message });
    }

    const body = request.body as Record<string, unknown>;
    const snapshot = await importPerformanceSnapshot(active.directory, parsed.data, {
      releaseId: typeof body.releaseId === "string" ? body.releaseId : undefined,
      releaseVersion: typeof body.releaseVersion === "string" ? body.releaseVersion : undefined,
      label: typeof body.label === "string" ? body.label : undefined,
    });

    return { status: "imported", snapshot };
  });

  app.post("/api/v1/performance/compare", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const parsed = ComparePerformanceInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_input", message: parsed.error.message });
    }

    const snapshots = await listPerformanceSnapshots(active.directory);
    const baseline = resolvePerformanceSnapshotRef(snapshots, parsed.data.baselineSnapshotId);
    const target = resolvePerformanceSnapshotRef(snapshots, parsed.data.targetSnapshotId);

    if (!baseline) {
      return reply.status(404).send({
        error: "not_found",
        message: `Baseline snapshot not found: ${parsed.data.baselineSnapshotId}`,
      });
    }
    if (!target) {
      return reply.status(404).send({
        error: "not_found",
        message: `Target snapshot not found: ${parsed.data.targetSnapshotId}`,
      });
    }

    const report = comparePerformanceSnapshots({
      workspaceName: active.name,
      baseline,
      target,
      thresholdPercent: parsed.data.thresholdPercent,
    });

    const reportPath = await savePerformanceComparisonReport(active.directory, report);
    const markdownPath = path.join(active.directory, FDT_PERFORMANCE_MARKDOWN);
    await mkdir(path.dirname(markdownPath), { recursive: true });
    await writeFile(markdownPath, renderPerformanceMarkdown(report), "utf8");

    return { status: "compared", report, reportPath, markdownPath };
  });

  app.get("/api/v1/reports/performance-comparison", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const reportPath = path.join(active.directory, FDT_PERFORMANCE_COMPARISON_REPORT);
    if (!existsSync(reportPath)) {
      return reply.status(404).send({
        error: "not_found",
        message:
          "No performance comparison report found. Run `pnpm fdt perf compare --from <id> --to <id>` then refresh.",
        hint: "Reports are written to <workspace>/.fdt/reports/performance-comparison.json",
      });
    }

    const report = PerformanceComparisonReportSchema.parse(
      JSON.parse(await readFile(reportPath, "utf8")),
    );
    return { report, reportPath };
  });

  app.get("/api/v1/releases/:id/performance", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const { id } = request.params as { id: string };
    const summary = await summarizePerformanceForRelease(active.directory, id);
    const snapshots = await listPerformanceSnapshots(active.directory);
    const releaseSnapshots = snapshots.filter(
      (snapshot) => snapshot.releaseId === id || snapshot.releaseVersion === id,
    );
    const comparison = await loadPerformanceComparisonReport(active.directory);

    return { summary, snapshots: releaseSnapshots, comparison };
  });

  app.post("/api/v1/performance/snapshots/:id/attach", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({ error: "not_found", message: "No active workspace selected." });
    }

    const { id } = request.params as { id: string };
    const parsed = AttachPerformanceSnapshotInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_input", message: parsed.error.message });
    }

    try {
      const snapshot = await attachPerformanceSnapshotToRelease(active.directory, id, parsed.data);
      return { status: "attached", snapshot };
    } catch (error) {
      return reply.status(404).send({
        error: "not_found",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
