import {
  FDT_ASSET_AUDITOR_REPORT,
  FDT_CI_PIPELINE_REPORT,
  FDT_ECONOMY_SIMULATION_REPORT,
  FDT_PERFORMANCE_COMPARISON_REPORT,
  FDT_RESOURCE_DOCTOR_REPORT,
  FDT_SECURITY_REPORT,
} from "@fdt/core";

export type SearchResultType = "module" | "report" | "action" | "docs";

export interface SearchCatalogEntry {
  id: string;
  type: SearchResultType;
  label: string;
  description: string;
  group: string;
  keywords: string[];
  page?: string;
  reportPath?: string;
  actionMethod?: "POST";
  actionPath?: string;
}

export const SEARCH_CATALOG: SearchCatalogEntry[] = [
  {
    id: "resources",
    type: "module",
    label: "Resources",
    description: "Resource Doctor scans and manifest validation",
    group: "Modules",
    keywords: ["validate", "fxmanifest", "doctor"],
    page: "resources",
  },
  {
    id: "items",
    type: "module",
    label: "Items",
    description: "Neutral item registry and export",
    group: "Modules",
    keywords: ["content", "inventory"],
    page: "items",
  },
  {
    id: "releases",
    type: "module",
    label: "Releases",
    description: "Release bundles and deploy checklists",
    group: "Modules",
    keywords: ["bundle", "deploy", "changelog"],
    page: "releases",
  },
  {
    id: "docs",
    type: "module",
    label: "Docs & Help",
    description: "Guides, shortcuts, and CLI reference",
    group: "Modules",
    keywords: ["help", "documentation", "guide"],
    page: "docs",
  },
  {
    id: "report-resource-doctor",
    type: "report",
    label: "Resource Doctor report",
    description: "Latest validation report from .fdt/reports/",
    group: "Reports",
    keywords: ["resource-doctor", "validation", "findings"],
    page: "resources",
    reportPath: FDT_RESOURCE_DOCTOR_REPORT,
  },
  {
    id: "report-asset-auditor",
    type: "report",
    label: "Asset auditor report",
    description: "Stream asset size and duplicate filename audit",
    group: "Reports",
    keywords: ["assets", "stream", "ytd"],
    page: "assets",
    reportPath: FDT_ASSET_AUDITOR_REPORT,
  },
  {
    id: "report-security",
    type: "report",
    label: "Security audit report",
    description: "Security baseline and vulnerability findings",
    group: "Reports",
    keywords: ["security", "audit", "ace"],
    page: "security",
    reportPath: FDT_SECURITY_REPORT,
  },
  {
    id: "report-ci",
    type: "report",
    label: "CI pipeline report",
    description: "Latest CI gate validation results",
    group: "Reports",
    keywords: ["ci", "pipeline", "github"],
    page: "ci",
    reportPath: FDT_CI_PIPELINE_REPORT,
  },
  {
    id: "report-performance",
    type: "report",
    label: "Performance comparison report",
    description: "Snapshot regression comparison",
    group: "Reports",
    keywords: ["performance", "resmon", "regression"],
    page: "performance",
    reportPath: FDT_PERFORMANCE_COMPARISON_REPORT,
  },
  {
    id: "report-economy",
    type: "report",
    label: "Economy simulation report",
    description: "Balance simulation output",
    group: "Reports",
    keywords: ["economy", "simulation", "balance"],
    page: "economy",
    reportPath: FDT_ECONOMY_SIMULATION_REPORT,
  },
  {
    id: "action-validate",
    type: "action",
    label: "Run resource validation",
    description: "POST validate against the active workspace",
    group: "Quick actions",
    keywords: ["validate", "scan", "doctor"],
    actionMethod: "POST",
    actionPath: "/api/v1/workspaces/active/validate",
  },
  {
    id: "action-audit-stream",
    type: "action",
    label: "Run stream asset audit",
    description: "POST stream audit on the active workspace",
    group: "Quick actions",
    keywords: ["audit", "stream", "assets"],
    actionMethod: "POST",
    actionPath: "/api/v1/workspaces/active/audit-stream",
  },
  {
    id: "action-content-validate",
    type: "action",
    label: "Validate content registries",
    description: "POST content validation for items, shops, and recipes",
    group: "Quick actions",
    keywords: ["content", "items", "shops"],
    actionMethod: "POST",
    actionPath: "/api/v1/content/validate",
  },
  {
    id: "api-docs",
    type: "docs",
    label: "API documentation (Swagger)",
    description: "Interactive OpenAPI reference for dashboard-api",
    group: "Documentation",
    keywords: ["openapi", "swagger", "api", "rest"],
    page: "api-docs",
  },
];
