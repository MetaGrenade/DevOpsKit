import type { FastifyInstance } from "fastify";
import { existsSync } from "node:fs";
import path from "node:path";
import { readFile } from "node:fs/promises";
import {
  FDT_ITEMS_FILE,
  FDT_RELEASES_REGISTRY,
  FDT_RESOURCE_DOCTOR_REPORT,
  FDT_ZONES_FILE,
} from "@fdt/core";
import { loadWorkspaceRegistry } from "../workspaces/registry-store.js";

export interface OnboardingStep {
  id: string;
  label: string;
  description: string;
  complete: boolean;
  page: string;
}

async function countJsonArray(filePath: string, key: string): Promise<number> {
  if (!existsSync(filePath)) {
    return 0;
  }
  try {
    const payload = JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;
    const value = payload[key];
    return Array.isArray(value) ? value.length : 0;
  } catch {
    return 0;
  }
}

async function resolveActiveWorkspaceDirectory(): Promise<string | null> {
  const registry = await loadWorkspaceRegistry();
  if (!registry.activeWorkspaceId) {
    return null;
  }

  const record = registry.workspaces.find((workspace) => workspace.id === registry.activeWorkspaceId);
  return record?.directory ?? null;
}

export async function registerOnboardingRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/onboarding/status", async () => {
    const activeDirectory = await resolveActiveWorkspaceDirectory();

    if (!activeDirectory) {
      const steps: OnboardingStep[] = [
        {
          id: "workspace",
          label: "Register a workspace",
          description: "Point FDT at your FiveM server folder",
          complete: false,
          page: "workspaces",
        },
        {
          id: "validate",
          label: "Run resource validation",
          description: "Scan manifests with Resource Doctor",
          complete: false,
          page: "resources",
        },
        {
          id: "content",
          label: "Add your first item",
          description: "Create neutral content in the item workbench",
          complete: false,
          page: "items",
        },
        {
          id: "release",
          label: "Create a release candidate",
          description: "Bundle validation evidence for deployment",
          complete: false,
          page: "releases",
        },
      ];
      return { complete: 0, total: steps.length, steps };
    }

    const hasResourceReport = existsSync(path.join(activeDirectory, FDT_RESOURCE_DOCTOR_REPORT));
    const itemCount = await countJsonArray(path.join(activeDirectory, FDT_ITEMS_FILE), "items");
    const zoneCount = await countJsonArray(path.join(activeDirectory, FDT_ZONES_FILE), "zones");
    const releaseCount = existsSync(path.join(activeDirectory, FDT_RELEASES_REGISTRY))
      ? await countJsonArray(path.join(activeDirectory, FDT_RELEASES_REGISTRY), "releases")
      : 0;

    const steps: OnboardingStep[] = [
      {
        id: "workspace",
        label: "Register a workspace",
        description: "Active workspace is selected",
        complete: true,
        page: "workspaces",
      },
      {
        id: "validate",
        label: "Run resource validation",
        description: "Resource Doctor report exists in .fdt/reports/",
        complete: hasResourceReport,
        page: "resources",
      },
      {
        id: "content",
        label: "Add your first item",
        description: "At least one item in the neutral registry",
        complete: itemCount > 0,
        page: "items",
      },
      {
        id: "zones",
        label: "Import or create a zone",
        description: "Zone registry has at least one entry",
        complete: zoneCount > 0,
        page: "zones",
      },
      {
        id: "release",
        label: "Create a release candidate",
        description: "At least one release recorded",
        complete: releaseCount > 0,
        page: "releases",
      },
    ];

    const complete = steps.filter((step) => step.complete).length;
    return { complete, total: steps.length, steps };
  });
}
