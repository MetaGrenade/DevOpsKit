import type { FastifyInstance } from "fastify";
import { CreateWorkspaceInputSchema, RegisterWorkspaceInputSchema, UpdateWorkspaceFrameworkInputSchema } from "@fdt/schemas";
import { validateResources } from "@fdt/validators";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { FDT_ASSET_AUDITOR_MARKDOWN, FDT_ASSET_AUDITOR_REPORT, FDT_REPORTS_DIR, FDT_SECURITY_BASELINE, FDT_SECURITY_REPORT } from "@fdt/core";
import { auditStreamAssets, renderAssetAuditorMarkdown, runCiPipeline, scanSecurity, writeCiPipelineReport } from "@fdt/validators";
import { SecurityBaselineSchema } from "@fdt/schemas";
import { setAssetAuditorReport, setResourceDoctorReport, setSecurityAuditReport } from "../reports/store.js";
import {
  createWorkspace,
  getActiveWorkspace,
  listWorkspaces,
  registerExistingWorkspace,
  removeWorkspace,
  selectWorkspace,
  updateActiveWorkspaceFramework,
} from "./service.js";
import { getWorkspaceRegistryPath } from "./registry-store.js";

export async function registerWorkspaceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/workspaces", async () => {
    const result = await listWorkspaces();
    return {
      registryPath: getWorkspaceRegistryPath(),
      activeWorkspaceId: result.activeWorkspaceId,
      workspaces: result.workspaces,
    };
  });

  app.get("/api/v1/workspaces/active", async (_request, reply) => {
    const active = await getActiveWorkspace();
    if (!active) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    return active;
  });

  app.post("/api/v1/workspaces", async (request, reply) => {
    const parsed = CreateWorkspaceInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_input",
        message: parsed.error.message,
      });
    }

    try {
      const workspace = await createWorkspace(parsed.data);
      return { status: "created", workspace };
    } catch (error) {
      return reply.status(400).send({
        error: "create_failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post("/api/v1/workspaces/register", async (request, reply) => {
    const parsed = RegisterWorkspaceInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_input",
        message: parsed.error.message,
      });
    }

    try {
      const workspace = await registerExistingWorkspace(parsed.data);
      return { status: "registered", workspace };
    } catch (error) {
      return reply.status(400).send({
        error: "register_failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post("/api/v1/workspaces/:id/select", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const workspace = await selectWorkspace(id);
      return { status: "selected", workspace };
    } catch (error) {
      return reply.status(404).send({
        error: "select_failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.delete("/api/v1/workspaces/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      await removeWorkspace(id);
      return { status: "removed", id };
    } catch (error) {
      return reply.status(404).send({
        error: "remove_failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.patch("/api/v1/workspaces/active/framework", async (request, reply) => {
    const parsed = UpdateWorkspaceFrameworkInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_input",
        message: parsed.error.message,
      });
    }

    try {
      const workspace = await updateActiveWorkspaceFramework(parsed.data);
      return { status: "updated", workspace };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const statusCode = message.includes("No active workspace") ? 404 : 400;
      return reply.status(statusCode).send({
        error: "update_failed",
        message,
      });
    }
  });

  app.post("/api/v1/workspaces/active/validate", async (_request, reply) => {
    const active = await getActiveWorkspace();
    if (!active) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    try {
      const report = await validateResources({
        workspaceRoot: active.directory,
        workspace: active.workspace,
      });

      const outPath = path.join(active.directory, FDT_REPORTS_DIR, "resource-doctor.json");
      await mkdir(path.dirname(outPath), { recursive: true });
      await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
      setResourceDoctorReport(report, active.directory);

      return {
        status: "validated",
        reportPath: outPath,
        summary: report.summary,
        generatedAt: report.generatedAt,
      };
    } catch (error) {
      return reply.status(500).send({
        error: "validation_failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post("/api/v1/workspaces/active/audit-stream", async (_request, reply) => {
    const active = await getActiveWorkspace();
    if (!active) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    try {
      const report = await auditStreamAssets({
        workspaceRoot: active.directory,
        workspace: active.workspace,
      });

      const outPath = path.join(active.directory, FDT_ASSET_AUDITOR_REPORT);
      const mdPath = path.join(active.directory, FDT_ASSET_AUDITOR_MARKDOWN);
      await mkdir(path.dirname(outPath), { recursive: true });
      await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
      await writeFile(mdPath, renderAssetAuditorMarkdown(report), "utf8");
      setAssetAuditorReport(report, active.directory);

      return {
        status: "audited",
        reportPath: outPath,
        markdownPath: mdPath,
        summary: report.summary,
        generatedAt: report.generatedAt,
      };
    } catch (error) {
      return reply.status(500).send({
        error: "audit_failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post("/api/v1/workspaces/active/security-scan", async (_request, reply) => {
    const active = await getActiveWorkspace();
    if (!active) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    try {
      const baselinePath = path.join(active.directory, FDT_SECURITY_BASELINE);
      let baselineFingerprints: string[] = [];
      if (existsSync(baselinePath)) {
        const baseline = SecurityBaselineSchema.parse(JSON.parse(await readFile(baselinePath, "utf8")));
        baselineFingerprints = baseline.findingFingerprints;
      }

      const report = await scanSecurity({
        workspaceRoot: active.directory,
        workspace: active.workspace,
        baselineFingerprints,
      });

      const outPath = path.join(active.directory, FDT_SECURITY_REPORT);
      await mkdir(path.dirname(outPath), { recursive: true });
      await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
      setSecurityAuditReport(report, active.directory);

      return {
        status: "scanned",
        reportPath: outPath,
        summary: report.summary,
        generatedAt: report.generatedAt,
      };
    } catch (error) {
      return reply.status(500).send({
        error: "scan_failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post("/api/v1/workspaces/active/security-baseline", async (_request, reply) => {
    const active = await getActiveWorkspace();
    if (!active) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    const reportPath = path.join(active.directory, FDT_SECURITY_REPORT);
    if (!existsSync(reportPath)) {
      return reply.status(404).send({
        error: "not_found",
        message: "No security audit report found. Run a security scan first.",
      });
    }

    const report = JSON.parse(await readFile(reportPath, "utf8")) as {
      findings: Array<{ fingerprint: string }>;
    };

    const baseline = SecurityBaselineSchema.parse({
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      workspaceName: active.workspace.name,
      findingFingerprints: report.findings.map((finding) => finding.fingerprint),
    });

    const baselinePath = path.join(active.directory, FDT_SECURITY_BASELINE);
    await mkdir(path.dirname(baselinePath), { recursive: true });
    await writeFile(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");

    const refreshed = await scanSecurity({
      workspaceRoot: active.directory,
      workspace: active.workspace,
      baselineFingerprints: baseline.findingFingerprints,
    });
    await writeFile(reportPath, `${JSON.stringify(refreshed, null, 2)}\n`, "utf8");
    setSecurityAuditReport(refreshed, active.directory);

    return {
      status: "baseline_saved",
      baselinePath,
      fingerprintCount: baseline.findingFingerprints.length,
      summary: refreshed.summary,
    };
  });

  app.post("/api/v1/workspaces/active/ci-run", async (_request, reply) => {
    const active = await getActiveWorkspace();
    if (!active) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    try {
      const report = await runCiPipeline({
        workspaceRoot: active.directory,
        workspace: active.workspace,
        gates: ["validate", "security", "qa", "clothing"],
        reportOnlyGates: ["validate"],
      });
      const reportPath = await writeCiPipelineReport(active.directory, report);

      return {
        status: report.passed ? "passed" : "failed",
        reportPath,
        passed: report.passed,
        gates: report.gates,
        generatedAt: report.generatedAt,
      };
    } catch (error) {
      return reply.status(500).send({
        error: "ci_run_failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
