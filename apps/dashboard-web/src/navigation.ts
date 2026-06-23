export type PageId =
  | "overview"
  | "workspaces"
  | "resources"
  | "items"
  | "commerce"
  | "economy"
  | "statebag"
  | "assets"
  | "zones"
  | "world"
  | "environment"
  | "releases"
  | "security"
  | "qa"
  | "ci"
  | "domains"
  | "performance"
  | "clothing"
  | "vehicles"
  | "maps"
  | "graph"
  | "nui"
  | "docs"
  | "api-docs";

export type NavIcon =
  | "overview"
  | "workspace"
  | "resource"
  | "item"
  | "commerce"
  | "economy"
  | "statebag"
  | "asset"
  | "zone"
  | "world"
  | "environment"
  | "release"
  | "security"
  | "qa"
  | "ci"
  | "domain"
  | "performance"
  | "clothing"
  | "vehicle"
  | "map"
  | "graph"
  | "nui"
  | "docs";

export interface NavItem {
  id: PageId;
  label: string;
  description: string;
  icon: NavIcon;
  keywords?: string[];
}

export interface NavGroup {
  id: string;
  label: string;
  summary?: string;
  items: NavItem[];
}

/** Sidebar order follows the intended daily workflow: setup → validate → build world → author content → ship → deploy. */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "start",
    label: "Start",
    summary: "Connect a server folder and pick your active workspace.",
    items: [
      {
        id: "overview",
        label: "Overview",
        description: "Getting started guide and feature catalog",
        icon: "overview",
        keywords: ["home", "guide", "features", "workflow"],
      },
      {
        id: "workspaces",
        label: "Workspaces",
        description: "Register server folders and switch context",
        icon: "workspace",
        keywords: ["server", "folder", "fdt.workspace.json"],
      },
      {
        id: "docs",
        label: "Docs & Help",
        description: "Guides, module reference, and shortcuts",
        icon: "docs",
        keywords: ["help", "documentation", "guide", "shortcuts", "cli", "manual"],
      },
      {
        id: "api-docs",
        label: "API Reference",
        description: "OpenAPI / Swagger documentation for dashboard-api",
        icon: "docs",
        keywords: ["openapi", "swagger", "rest", "api", "endpoints"],
      },
    ],
  },
  {
    id: "validate",
    label: "Validate",
    summary: "Scan manifests, map dependencies, and audit security before you ship.",
    items: [
      {
        id: "resources",
        label: "Resources",
        description: "Resource Doctor scans and manifest fixes",
        icon: "resource",
        keywords: ["fxmanifest", "doctor", "validate"],
      },
      {
        id: "graph",
        label: "Dependency Graph",
        description: "Resource load order and relationships",
        icon: "graph",
        keywords: ["dependencies", "ensure", "load order"],
      },
      {
        id: "security",
        label: "Security",
        description: "Baseline audits and vulnerability findings",
        icon: "security",
        keywords: ["audit", "ace", "exploit"],
      },
    ],
  },
  {
    id: "world",
    label: "World",
    summary: "Place interactions in-game with devtools, then package maps and stream assets.",
    items: [
      {
        id: "zones",
        label: "Zones",
        description: "Import devtools zones or add locations manually",
        icon: "zone",
        keywords: ["devtools", "territory", "interaction"],
      },
      {
        id: "world",
        label: "World Tools",
        description: "Blips, props, and door definitions",
        icon: "world",
        keywords: ["blip", "prop", "door", "devtools"],
      },
      {
        id: "maps",
        label: "Maps / MLO",
        description: "Map scaffolds, audits, and release checklists",
        icon: "map",
        keywords: ["mlo", "ymap", "ytyp", "stream"],
      },
      {
        id: "assets",
        label: "Assets",
        description: "Stream asset inventory and size audits",
        icon: "asset",
        keywords: ["ydr", "ytd", "stream", "audit"],
      },
    ],
  },
  {
    id: "content",
    label: "Content",
    summary: "Author neutral JSON under .fdt/content and export to your framework adapter.",
    items: [
      {
        id: "items",
        label: "Items",
        description: "Neutral item registry and validation",
        icon: "item",
        keywords: ["inventory", "ox", "qbcore"],
      },
      {
        id: "commerce",
        label: "Commerce",
        description: "Shop inventories and crafting recipes",
        icon: "commerce",
        keywords: ["shop", "crafting", "recipe"],
      },
      {
        id: "domains",
        label: "Domains",
        description: "Jobs, gangs, businesses from zones",
        icon: "domain",
        keywords: ["job", "gang", "business", "vehicle registry"],
      },
      {
        id: "economy",
        label: "Economy",
        description: "Balance simulation and tuning",
        icon: "economy",
        keywords: ["money", "sink", "simulation"],
      },
      {
        id: "vehicles",
        label: "Vehicles",
        description: "Fleet packs, handling, and exports",
        icon: "vehicle",
        keywords: ["handling", "spawn", "fleet"],
      },
      {
        id: "clothing",
        label: "Clothing",
        description: "Pack indexing and conflict checks",
        icon: "clothing",
        keywords: ["drawable", "texture", "stream"],
      },
    ],
  },
  {
    id: "ship",
    label: "Ship",
    summary: "Attach QA and performance evidence, run CI gates, and cut release bundles.",
    items: [
      {
        id: "qa",
        label: "QA",
        description: "Scenario runs and regression tracking",
        icon: "qa",
        keywords: ["scenario", "test", "devtools"],
      },
      {
        id: "performance",
        label: "Performance",
        description: "Resource snapshots and regressions",
        icon: "performance",
        keywords: ["resmon", "ms", "snapshot"],
      },
      {
        id: "ci",
        label: "CI",
        description: "Pipeline gates and validation reports",
        icon: "ci",
        keywords: ["github actions", "gate", "pipeline"],
      },
      {
        id: "releases",
        label: "Releases",
        description: "Bundles, diffs, and deploy checklists",
        icon: "release",
        keywords: ["bundle", "changelog", "deploy"],
      },
    ],
  },
  {
    id: "deploy",
    label: "Deploy",
    summary: "Generate server configs and keep NUI/state contracts in sync.",
    items: [
      {
        id: "environment",
        label: "Environment",
        description: "server.cfg profiles and txAdmin recipes",
        icon: "environment",
        keywords: ["server.cfg", "txadmin", "profile"],
      },
      {
        id: "nui",
        label: "NUI Bridge",
        description: "Schema sync and TypeScript codegen",
        icon: "nui",
        keywords: ["typescript", "schema", "codegen"],
      },
      {
        id: "statebag",
        label: "State Bag",
        description: "Entity sync snapshots from devtools",
        icon: "statebag",
        keywords: ["statebag", "replication", "sync"],
      },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export function findNavItem(page: PageId): NavItem | undefined {
  return ALL_NAV_ITEMS.find((item) => item.id === page);
}

export function filterNavGroups(query: string): NavGroup[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return NAV_GROUPS;
  }

  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      const haystack = [
        item.label,
        item.description,
        item.id,
        group.label,
        group.summary ?? "",
        ...(item.keywords ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    }),
  })).filter((group) => group.items.length > 0);
}
