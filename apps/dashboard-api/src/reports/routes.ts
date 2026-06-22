import type { FastifyInstance } from "fastify";
import {
  CiPipelineReportSchema,
  ResourceDoctorReportSchema,
  AssetAuditorReportSchema,
  SecurityAuditReportSchema,
} from "@fdt/schemas";
import {
  loadReportFromWorkspace,
  loadAssetAuditorReportFromWorkspace,
  loadSecurityAuditReportFromWorkspace,
} from "./loader.js";
import {
  getResourceDoctorReport,
  setResourceDoctorReport,
  getAssetAuditorReport,
  setAssetAuditorReport,
  getSecurityAuditReport,
  setSecurityAuditReport,
} from "./store.js";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { FDT_CI_PIPELINE_REPORT } from "@fdt/core";
import { getActiveWorkspaceDirectory } from "../workspaces/service.js";

async function loadResourceDoctorForActiveWorkspace(activeDirectory: string) {
  const loaded = await loadReportFromWorkspace(activeDirectory);
  if (!loaded) {
    return null;
  }

  setResourceDoctorReport(loaded.report, activeDirectory);
  return loaded.report;
}

async function loadAssetAuditorForActiveWorkspace(activeDirectory: string) {
  const loaded = await loadAssetAuditorReportFromWorkspace(activeDirectory);
  if (!loaded) {
    return null;
  }

  setAssetAuditorReport(loaded.report, activeDirectory);
  return loaded.report;
}

async function loadSecurityAuditForActiveWorkspace(activeDirectory: string) {
  const loaded = await loadSecurityAuditReportFromWorkspace(activeDirectory);
  if (!loaded) {
    return null;
  }

  setSecurityAuditReport(loaded.report, activeDirectory);
  return loaded.report;
}

export async function registerReportRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/reports/resource-doctor", async (_request, reply) => {
    const activeDirectory = await getActiveWorkspaceDirectory();
    if (!activeDirectory) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    const fromDisk = await loadResourceDoctorForActiveWorkspace(activeDirectory);
    if (fromDisk) {
      return fromDisk;
    }

    const cached = getResourceDoctorReport(activeDirectory);
    if (cached) {
      return cached;
    }

    return reply.status(404).send({
      error: "not_found",
      message:
        "No resource doctor report found. Run `pnpm fdt validate resources --workspace <path>` then refresh this page.",
      hint: "Reports are written to <workspace>/.fdt/reports/resource-doctor.json",
    });
  });

  app.get("/api/v1/reports/asset-auditor", async (_request, reply) => {
    const activeDirectory = await getActiveWorkspaceDirectory();
    if (!activeDirectory) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    const fromDisk = await loadAssetAuditorForActiveWorkspace(activeDirectory);
    if (fromDisk) {
      return fromDisk;
    }

    const cached = getAssetAuditorReport(activeDirectory);
    if (cached) {
      return cached;
    }

    return reply.status(404).send({
      error: "not_found",
      message:
        "No asset auditor report found. Run `pnpm fdt audit stream --workspace <path>` then refresh.",
      hint: "Reports are written to <workspace>/.fdt/reports/asset-auditor.json",
    });
  });

  app.post("/api/v1/reports/asset-auditor", async (request, reply) => {
    const parsed = AssetAuditorReportSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_report",
        message: parsed.error.message,
      });
    }

    const activeDirectory = await getActiveWorkspaceDirectory();
    setAssetAuditorReport(parsed.data, activeDirectory ?? undefined);

    return {
      status: "imported",
      summary: parsed.data.summary,
      generatedAt: parsed.data.generatedAt,
    };
  });

  app.post("/api/v1/reports/resource-doctor/load", async (request, reply) => {
    const body = (request.body ?? {}) as { workspaceRoot?: string; searchRoot?: string };
    const activeDirectory =
      body.workspaceRoot ?? (await getActiveWorkspaceDirectory()) ?? undefined;

    if (!activeDirectory) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    const loaded = await loadResourceDoctorForActiveWorkspace(activeDirectory);
    if (!loaded) {
      return reply.status(404).send({
        error: "not_found",
        message: "No resource-doctor.json report found on disk for the active workspace.",
      });
    }

    return {
      status: "loaded",
      path: path.join(activeDirectory, ".fdt", "reports", "resource-doctor.json"),
      summary: loaded.summary,
      generatedAt: loaded.generatedAt,
    };
  });

  app.post("/api/v1/reports/resource-doctor", async (request, reply) => {
    const parsed = ResourceDoctorReportSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_report",
        message: parsed.error.message,
      });
    }

    const activeDirectory = await getActiveWorkspaceDirectory();
    setResourceDoctorReport(parsed.data, activeDirectory ?? undefined);

    return {
      status: "imported",
      summary: parsed.data.summary,
      generatedAt: parsed.data.generatedAt,
    };
  });

  app.get("/api/v1/reports/security-audit", async (_request, reply) => {
    const activeDirectory = await getActiveWorkspaceDirectory();
    if (!activeDirectory) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    const fromDisk = await loadSecurityAuditForActiveWorkspace(activeDirectory);
    if (fromDisk) {
      return fromDisk;
    }

    const cached = getSecurityAuditReport(activeDirectory);
    if (cached) {
      return cached;
    }

    return reply.status(404).send({
      error: "not_found",
      message:
        "No security audit report found. Run `pnpm fdt security scan --workspace <path>` then refresh.",
      hint: "Reports are written to <workspace>/.fdt/reports/security-audit.json",
    });
  });

  app.post("/api/v1/reports/security-audit", async (request, reply) => {
    const parsed = SecurityAuditReportSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_report",
        message: parsed.error.message,
      });
    }

    const activeDirectory = await getActiveWorkspaceDirectory();
    setSecurityAuditReport(parsed.data, activeDirectory ?? undefined);

    return {
      status: "imported",
      summary: parsed.data.summary,
      generatedAt: parsed.data.generatedAt,
    };
  });

  app.get("/api/v1/reports/ci-pipeline", async (_request, reply) => {
    const activeDirectory = await getActiveWorkspaceDirectory();
    if (!activeDirectory) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    const reportPath = path.join(activeDirectory, FDT_CI_PIPELINE_REPORT);
    if (!existsSync(reportPath)) {
      return reply.status(404).send({
        error: "not_found",
        message:
          "No CI pipeline report found. Run `pnpm fdt ci run --workspace <path>` then refresh.",
        hint: "Reports are written to <workspace>/.fdt/reports/ci-pipeline.json",
      });
    }

    const report = CiPipelineReportSchema.parse(JSON.parse(await readFile(reportPath, "utf8")));
    return { report, reportPath };
  });
}
