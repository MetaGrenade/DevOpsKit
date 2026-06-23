import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createWorkspaceRecord } from "@fdt/core";
import { buildApp } from "./app.js";
import { saveWorkspaceRegistry } from "./workspaces/registry-store.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SAMPLE_WORKSPACE = path.join(REPO_ROOT, "resources/sample-workspaces/basic-server");

describe("phase 8 routes", () => {
  const previousDataDir = process.env.FDT_DATA_DIR;
  let registryDir: string | null = null;

  afterEach(async () => {
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

  it("serves OpenAPI JSON and Swagger HTML docs", async () => {
    const app = await buildApp();

    try {
      const specResponse = await app.inject({
        method: "GET",
        url: "/api/v1/openapi.json",
      });

      expect(specResponse.statusCode).toBe(200);
      const spec = specResponse.json() as { openapi: string; info: { title: string }; paths: Record<string, unknown> };
      expect(spec.openapi).toBe("3.0.3");
      expect(spec.info.title).toContain("Dashboard API");
      expect(spec.paths["/api/v1/search"]).toBeDefined();
      expect(spec.paths["/api/v1/onboarding/status"]).toBeDefined();

      const docsResponse = await app.inject({
        method: "GET",
        url: "/api/v1/docs",
      });

      expect(docsResponse.statusCode).toBe(200);
      expect(docsResponse.headers["content-type"]).toMatch(/text\/html/);
      expect(docsResponse.body).toContain("swagger-ui");
    } finally {
      await app.close();
    }
  });

  it("searches the catalog and enriches report availability for the active workspace", async () => {
    registryDir = await mkdtemp(path.join(os.tmpdir(), "fdt-api-phase8-search-"));
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

    const app = await buildApp();

    try {
      const emptyResponse = await app.inject({
        method: "GET",
        url: "/api/v1/search",
      });

      expect(emptyResponse.statusCode).toBe(200);
      const emptyPayload = emptyResponse.json() as { query: string; results: Array<{ id: string }> };
      expect(emptyPayload.query).toBe("");
      expect(emptyPayload.results.length).toBeGreaterThan(0);

      const filteredResponse = await app.inject({
        method: "GET",
        url: "/api/v1/search?q=resource",
      });

      expect(filteredResponse.statusCode).toBe(200);
      const filteredPayload = filteredResponse.json() as {
        query: string;
        results: Array<{ id: string; type: string; available?: boolean }>;
      };
      expect(filteredPayload.query).toBe("resource");
      expect(filteredPayload.results.some((entry) => entry.id === "resources")).toBe(true);

      const reportEntry = filteredPayload.results.find((entry) => entry.type === "report");
      if (reportEntry) {
        expect(typeof reportEntry.available).toBe("boolean");
      }
    } finally {
      await app.close();
    }
  });

  it("returns onboarding steps without a workspace", async () => {
    registryDir = await mkdtemp(path.join(os.tmpdir(), "fdt-api-phase8-onboarding-"));
    process.env.FDT_DATA_DIR = registryDir;

    await saveWorkspaceRegistry({
      schemaVersion: 1,
      activeWorkspaceId: null,
      workspaces: [],
    });

    const app = await buildApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/onboarding/status",
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json() as {
        complete: number;
        total: number;
        steps: Array<{ id: string; complete: boolean }>;
      };
      expect(payload.complete).toBe(0);
      expect(payload.total).toBe(4);
      expect(payload.steps.map((step) => step.id)).toEqual(["workspace", "validate", "content", "release"]);
      expect(payload.steps.every((step) => step.complete === false)).toBe(true);
    } finally {
      await app.close();
    }
  });

  it("returns onboarding progress for the sample workspace", async () => {
    registryDir = await mkdtemp(path.join(os.tmpdir(), "fdt-api-phase8-onboarding-active-"));
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

    const app = await buildApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/onboarding/status",
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json() as {
        complete: number;
        total: number;
        steps: Array<{ id: string; complete: boolean }>;
      };
      expect(payload.total).toBe(5);
      expect(payload.steps.find((step) => step.id === "workspace")?.complete).toBe(true);
      expect(payload.complete).toBeGreaterThanOrEqual(1);
    } finally {
      await app.close();
    }
  });
});
