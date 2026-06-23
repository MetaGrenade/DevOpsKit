/** OpenAPI 3.0 document for the FDT dashboard API. Served at GET /api/v1/openapi.json */
export const OPENAPI_SPEC = {
  openapi: "3.0.3",
  info: {
    title: "FiveM DevOps Toolkit — Dashboard API",
    version: "0.0.1-alpha",
    description:
      "REST API backing the FDT dashboard. All workspace-scoped routes require an active workspace selected via /api/v1/workspaces/:id/select.",
  },
  servers: [{ url: "http://localhost:3001", description: "Local development" }],
  tags: [
    { name: "System", description: "Health and metadata" },
    { name: "Workspaces", description: "Workspace registry and active context" },
    { name: "Reports", description: "Validation and audit reports from .fdt/reports/" },
    { name: "Content", description: "Neutral item, shop, and crafting registries" },
    { name: "World", description: "Zones, world tools, maps, assets" },
    { name: "Ship", description: "Releases, QA, performance, CI" },
    { name: "Deploy", description: "Environment profiles and exports" },
    { name: "Search", description: "Global search and onboarding" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["System"],
        summary: "Health check",
        responses: { "200": { description: "API is running" } },
      },
    },
    "/api/v1/overview": {
      get: {
        tags: ["System"],
        summary: "Dashboard overview and module list",
        responses: { "200": { description: "Overview payload" } },
      },
    },
    "/api/v1/openapi.json": {
      get: {
        tags: ["System"],
        summary: "OpenAPI specification (this document)",
        responses: { "200": { description: "OpenAPI JSON" } },
      },
    },
    "/api/v1/workspaces": {
      get: {
        tags: ["Workspaces"],
        summary: "List registered workspaces",
        responses: { "200": { description: "Workspace registry" } },
      },
      post: {
        tags: ["Workspaces"],
        summary: "Create a new workspace on disk",
        responses: { "201": { description: "Workspace created" } },
      },
    },
    "/api/v1/workspaces/active": {
      get: {
        tags: ["Workspaces"],
        summary: "Get the active workspace with config",
        responses: {
          "200": { description: "Active workspace" },
          "404": { description: "No active workspace" },
        },
      },
    },
    "/api/v1/workspaces/{id}/select": {
      post: {
        tags: ["Workspaces"],
        summary: "Select a workspace as active",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Workspace selected" } },
      },
    },
    "/api/v1/workspaces/active/validate": {
      post: {
        tags: ["Workspaces"],
        summary: "Run Resource Doctor against the active workspace",
        responses: { "200": { description: "Validation summary" } },
      },
    },
    "/api/v1/workspaces/active/audit-stream": {
      post: {
        tags: ["Workspaces"],
        summary: "Run stream asset audit on the active workspace",
        responses: { "200": { description: "Audit summary" } },
      },
    },
    "/api/v1/reports/resource-doctor": {
      get: {
        tags: ["Reports"],
        summary: "Load Resource Doctor report",
        responses: { "200": { description: "Report JSON" }, "404": { description: "Not found" } },
      },
      post: {
        tags: ["Reports"],
        summary: "Import Resource Doctor report JSON",
        responses: { "200": { description: "Report stored" } },
      },
    },
    "/api/v1/reports/asset-auditor": {
      get: {
        tags: ["Reports"],
        summary: "Load asset auditor report",
        responses: { "200": { description: "Report JSON" }, "404": { description: "Not found" } },
      },
    },
    "/api/v1/reports/security-audit": {
      get: {
        tags: ["Reports"],
        summary: "Load security audit report",
        responses: { "200": { description: "Report JSON" }, "404": { description: "Not found" } },
      },
    },
    "/api/v1/reports/ci-pipeline": {
      get: {
        tags: ["Reports"],
        summary: "Load CI pipeline report",
        responses: { "200": { description: "Report JSON" }, "404": { description: "Not found" } },
      },
    },
    "/api/v1/reports/performance-comparison": {
      get: {
        tags: ["Reports"],
        summary: "Load performance comparison report",
        responses: { "200": { description: "Report JSON" }, "404": { description: "Not found" } },
      },
    },
    "/api/v1/reports/economy-simulation": {
      get: {
        tags: ["Reports"],
        summary: "Load economy simulation report",
        responses: { "200": { description: "Report JSON" }, "404": { description: "Not found" } },
      },
    },
    "/api/v1/content/items": {
      get: { tags: ["Content"], summary: "List neutral items", responses: { "200": { description: "Item registry" } } },
      post: { tags: ["Content"], summary: "Create or update an item", responses: { "200": { description: "Item saved" } } },
    },
    "/api/v1/content/shops": {
      get: { tags: ["Content"], summary: "List shops", responses: { "200": { description: "Shop registry" } } },
      post: { tags: ["Content"], summary: "Create or update a shop", responses: { "200": { description: "Shop saved" } } },
    },
    "/api/v1/content/crafting": {
      get: { tags: ["Content"], summary: "List crafting recipes", responses: { "200": { description: "Recipe registry" } } },
      post: { tags: ["Content"], summary: "Create or update a recipe", responses: { "200": { description: "Recipe saved" } } },
    },
    "/api/v1/content/validate": {
      post: { tags: ["Content"], summary: "Validate content registries", responses: { "200": { description: "Validation report" } } },
    },
    "/api/v1/content/export": {
      post: { tags: ["Content"], summary: "Export content to a framework adapter", responses: { "200": { description: "Export files" } } },
    },
    "/api/v1/zones": {
      get: { tags: ["World"], summary: "List zones", responses: { "200": { description: "Zone registry" } } },
      post: { tags: ["World"], summary: "Create or update a zone", responses: { "200": { description: "Zone saved" } } },
    },
    "/api/v1/zones/import": {
      post: { tags: ["World"], summary: "Import zones from devtools export", responses: { "200": { description: "Import result" } } },
    },
    "/api/v1/releases": {
      get: { tags: ["Ship"], summary: "List releases", responses: { "200": { description: "Release list" } } },
      post: { tags: ["Ship"], summary: "Create a release candidate", responses: { "201": { description: "Release created" } } },
    },
    "/api/v1/qa/scenarios": {
      get: { tags: ["Ship"], summary: "List QA scenarios", responses: { "200": { description: "Scenario list" } } },
      post: { tags: ["Ship"], summary: "Save a QA scenario", responses: { "200": { description: "Scenario saved" } } },
    },
    "/api/v1/qa/runs": {
      get: { tags: ["Ship"], summary: "List QA runs", responses: { "200": { description: "Run list" } } },
    },
    "/api/v1/performance/snapshots": {
      get: { tags: ["Ship"], summary: "List performance snapshots", responses: { "200": { description: "Snapshot list" } } },
    },
    "/api/v1/performance/compare": {
      post: { tags: ["Ship"], summary: "Compare two performance snapshots", responses: { "200": { description: "Comparison report" } } },
    },
    "/api/v1/environment/profiles": {
      get: { tags: ["Deploy"], summary: "List environment profiles", responses: { "200": { description: "Profiles" }, "404": { description: "None configured" } } },
    },
    "/api/v1/environment/generate-cfg": {
      post: { tags: ["Deploy"], summary: "Generate server.cfg for a profile", responses: { "200": { description: "Generated config" } } },
    },
    "/api/v1/search": {
      get: {
        tags: ["Search"],
        summary: "Global search across modules, reports, and quick actions",
        parameters: [
          { name: "q", in: "query", schema: { type: "string" }, description: "Optional filter query" },
        ],
        responses: { "200": { description: "Search results" } },
      },
    },
    "/api/v1/onboarding/status": {
      get: {
        tags: ["Search"],
        summary: "Onboarding checklist progress for the active workspace",
        responses: { "200": { description: "Checklist steps with completion state" } },
      },
    },
  },
} as const;
