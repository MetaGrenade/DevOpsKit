import path from "node:path";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it, afterEach } from "vitest";
import { createWorkspaceRecord } from "@fdt/core";
import { ResourceDoctorReportSchema, type ResourceDoctorReport } from "@fdt/schemas";
import { buildApp } from "../app.js";
import { findLatestResourceDoctorReport, resolveResourceDoctorReport } from "./loader.js";
import { clearAllReportCaches, clearResourceDoctorReport, setResourceDoctorReport } from "./store.js";
import { saveWorkspaceRegistry } from "../workspaces/registry-store.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const SAMPLE_WORKSPACE = path.join(REPO_ROOT, "resources/sample-workspaces/basic-server");
const SAMPLE_RESOURCE_DOCTOR_REPORT = path.join(
  SAMPLE_WORKSPACE,
  ".fdt",
  "reports",
  "resource-doctor.json",
);

function createSampleResourceDoctorReport(workspaceRoot: string): ResourceDoctorReport {
  return ResourceDoctorReportSchema.parse({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    workspaceName: "Sample FiveM Server",
    workspaceRoot,
    summary: {
      resourcesScanned: 9,
      errors: 0,
      warnings: 0,
      info: 0,
      passed: 9,
    },
    resources: [],
    serverCfg: { path: "server/server.cfg", started: [], ensured: [] },
    findings: [],
  });
}

async function ensureSampleResourceDoctorReport(): Promise<void> {
  try {
    await access(SAMPLE_RESOURCE_DOCTOR_REPORT);
    return;
  } catch {
    // Generated reports live under .fdt/, which is gitignored — create a fixture on CI.
  }

  await mkdir(path.dirname(SAMPLE_RESOURCE_DOCTOR_REPORT), { recursive: true });
  await writeFile(
    SAMPLE_RESOURCE_DOCTOR_REPORT,
    `${JSON.stringify(createSampleResourceDoctorReport(SAMPLE_WORKSPACE), null, 2)}\n`,
    "utf8",
  );
}

beforeAll(async () => {
  await ensureSampleResourceDoctorReport();
});

describe("report loader", () => {
  it("finds the sample workspace report on disk", async () => {
    const loaded = await findLatestResourceDoctorReport(REPO_ROOT);
    expect(loaded).not.toBeNull();
    expect(loaded?.report.summary.resourcesScanned).toBeGreaterThan(0);
  });

  it("resolves env paths relative to monorepo root when cwd is dashboard-api", async () => {
    const previousWorkspace = process.env.FDT_WORKSPACE_ROOT;
    const previousRepoRoot = process.env.FDT_REPO_ROOT;
    const previousCwd = process.cwd();

    process.env.FDT_WORKSPACE_ROOT = "resources/sample-workspaces/basic-server";
    process.env.FDT_REPO_ROOT = ".";
    process.chdir(path.join(REPO_ROOT, "apps", "dashboard-api"));

    try {
      const loaded = await resolveResourceDoctorReport();
      expect(loaded).not.toBeNull();
      expect(loaded?.report.workspaceName).toBe("Sample FiveM Server");
    } finally {
      process.chdir(previousCwd);
      if (previousWorkspace === undefined) {
        delete process.env.FDT_WORKSPACE_ROOT;
      } else {
        process.env.FDT_WORKSPACE_ROOT = previousWorkspace;
      }
      if (previousRepoRoot === undefined) {
        delete process.env.FDT_REPO_ROOT;
      } else {
        process.env.FDT_REPO_ROOT = previousRepoRoot;
      }
    }
  });
});

describe("report routes", () => {
  const previousDataDir = process.env.FDT_DATA_DIR;
  let registryDir: string | null = null;

  afterEach(async () => {
    clearAllReportCaches();
    delete process.env.FDT_WORKSPACE_ROOT;
    delete process.env.FDT_REPO_ROOT;

    if (registryDir) {
      await rm(registryDir, { recursive: true, force: true });
      registryDir = null;
    }

    if (previousDataDir === undefined) {
      delete process.env.FDT_DATA_DIR;
    } else {
      process.env.FDT_DATA_DIR = previousDataDir;
    }
  });

  it("loads a report from disk when memory is empty", async () => {
    registryDir = await mkdtemp(path.join(os.tmpdir(), "fdt-api-report-registry-"));
    process.env.FDT_DATA_DIR = registryDir;

    const sampleRecord = createWorkspaceRecord(
      SAMPLE_WORKSPACE,
      path.join(SAMPLE_WORKSPACE, "fdt.workspace.json"),
      "Sample FiveM Server",
    );

    await saveWorkspaceRegistry({
      schemaVersion: 1,
      activeWorkspaceId: sampleRecord.id,
      workspaces: [sampleRecord],
    });

    clearResourceDoctorReport();
    const app = await buildApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/reports/resource-doctor",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        workspaceName: "Sample FiveM Server",
      });

      await app.close();
    } finally {
      // registry cleanup handled in afterEach
    }
  });

  it("imports and returns a resource doctor report for the active workspace", async () => {
    registryDir = await mkdtemp(path.join(os.tmpdir(), "fdt-api-report-registry-"));
    process.env.FDT_DATA_DIR = registryDir;

    const sampleRecord = createWorkspaceRecord(
      SAMPLE_WORKSPACE,
      path.join(SAMPLE_WORKSPACE, "fdt.workspace.json"),
      "Sample FiveM Server",
    );

    await saveWorkspaceRegistry({
      schemaVersion: 1,
      activeWorkspaceId: sampleRecord.id,
      workspaces: [sampleRecord],
    });

    clearAllReportCaches();
    const sampleReport = ResourceDoctorReportSchema.parse({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      workspaceName: "Test",
      workspaceRoot: SAMPLE_WORKSPACE,
      summary: {
        resourcesScanned: 1,
        errors: 0,
        warnings: 0,
        info: 0,
        passed: 1,
      },
      resources: [],
      serverCfg: { path: "server/server.cfg", started: [], ensured: [] },
      findings: [],
    });

    const app = await buildApp();

    const importResponse = await app.inject({
      method: "POST",
      url: "/api/v1/reports/resource-doctor",
      payload: sampleReport,
    });
    expect(importResponse.statusCode).toBe(200);

    const getResponse = await app.inject({
      method: "GET",
      url: "/api/v1/reports/resource-doctor",
    });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json()).toMatchObject({ workspaceName: "Sample FiveM Server" });

    await app.close();
  });

  it("returns the active workspace report after switching workspaces instead of a stale cache", async () => {
    registryDir = await mkdtemp(path.join(os.tmpdir(), "fdt-api-report-registry-"));
    process.env.FDT_DATA_DIR = registryDir;

    const sampleRecord = createWorkspaceRecord(
      SAMPLE_WORKSPACE,
      path.join(SAMPLE_WORKSPACE, "fdt.workspace.json"),
      "Sample FiveM Server",
    );

    await saveWorkspaceRegistry({
      schemaVersion: 1,
      activeWorkspaceId: sampleRecord.id,
      workspaces: [sampleRecord],
    });

    clearAllReportCaches();
    setResourceDoctorReport(
      ResourceDoctorReportSchema.parse({
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        workspaceName: "Stale Cache",
        workspaceRoot: path.join(registryDir, "other-workspace"),
        summary: {
          resourcesScanned: 99,
          errors: 0,
          warnings: 0,
          info: 0,
          passed: 99,
        },
        resources: [],
        serverCfg: { path: "server/server.cfg", started: [], ensured: [] },
        findings: [],
      }),
      path.join(registryDir, "other-workspace"),
    );

    const app = await buildApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/reports/resource-doctor",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        workspaceName: "Sample FiveM Server",
      });
      expect(response.json().summary.resourcesScanned).not.toBe(99);
    } finally {
      await app.close();
    }
  });
});
