import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerReportRoutes } from "./reports/routes.js";
import { registerWorkspaceRoutes } from "./workspaces/routes.js";
import { registerFilesystemRoutes } from "./fs/routes.js";
import { registerContentRoutes } from "./content/routes.js";
import { registerZoneRoutes } from "./zones/routes.js";
import { registerReleaseRoutes } from "./releases/routes.js";
import { registerQaRoutes } from "./qa/routes.js";
import { registerDomainRoutes } from "./domains/routes.js";
import { registerPerformanceRoutes } from "./performance/routes.js";
import { registerClothingRoutes } from "./clothing/routes.js";
import { registerVehicleRoutes } from "./vehicles/routes.js";
import { registerMapRoutes } from "./maps/routes.js";
import { registerEconomyRoutes } from "./economy/routes.js";
import { registerStateBagRoutes } from "./statebag/routes.js";
import { registerGraphRoutes } from "./graph/routes.js";
import { registerNuiRoutes } from "./nui/routes.js";
import { registerWorldRoutes } from "./world/routes.js";
import { registerEnvironmentRoutes } from "./environment/routes.js";

export async function buildApp() {
  const app = Fastify({ logger: false });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "fdt-dashboard-api",
    version: "0.0.0",
  }));

  app.get("/api/v1/overview", async () => ({
    name: "FiveM DevOps Toolkit",
    phase: "environment-builder",
    modules: [
      { id: "workspaces", status: "active" },
      { id: "resource-doctor", status: "active" },
      { id: "item-workbench", status: "active" },
      { id: "asset-auditor", status: "active" },
      { id: "dev-overlay", status: "active" },
      { id: "release-manager", status: "active" },
      { id: "security-auditor", status: "active" },
      { id: "qa-runner", status: "active" },
      { id: "ci-integration", status: "active" },
      { id: "domain-builders", status: "active" },
      { id: "performance-dashboard", status: "active" },
      { id: "jobs-gangs-builders", status: "active" },
      { id: "clothing-packs", status: "active" },
      { id: "vehicle-pack-builder", status: "active" },
      { id: "map-mlo-packaging", status: "active" },
      { id: "dependency-graph", status: "active" },
      { id: "nui-schema-sync", status: "active" },
      { id: "economy-simulator", status: "active" },
      { id: "state-bag-visualizer", status: "active" },
      { id: "release-diff-checklist", status: "active" },
      { id: "shop-crafting-builders", status: "active" },
      { id: "dev-overlay-world-tools", status: "active" },
      { id: "environment-builder", status: "active" },
    ],
  }));

  await registerWorkspaceRoutes(app);
  await registerFilesystemRoutes(app);
  await registerReportRoutes(app);
  await registerContentRoutes(app);
  await registerZoneRoutes(app);
  await registerReleaseRoutes(app);
  await registerQaRoutes(app);
  await registerDomainRoutes(app);
  await registerPerformanceRoutes(app);
  await registerClothingRoutes(app);
  await registerVehicleRoutes(app);
  await registerMapRoutes(app);
  await registerGraphRoutes(app);
  await registerNuiRoutes(app);
  await registerEconomyRoutes(app);
  await registerStateBagRoutes(app);
  await registerWorldRoutes(app);
  await registerEnvironmentRoutes(app);

  return app;
}
