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
  | "nui";

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
  | "nui";

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
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "core",
    label: "Core",
    items: [
      {
        id: "overview",
        label: "Overview",
        description: "Platform status and modules",
        icon: "overview",
        keywords: ["home", "dashboard"],
      },
      {
        id: "workspaces",
        label: "Workspaces",
        description: "Server folders and config",
        icon: "workspace",
        keywords: ["server", "folder"],
      },
      {
        id: "resources",
        label: "Resources",
        description: "Scan results and manifests",
        icon: "resource",
        keywords: ["fxmanifest", "doctor"],
      },
    ],
  },
  {
    id: "content",
    label: "Content",
    items: [
      {
        id: "items",
        label: "Items",
        description: "Item workbench and exports",
        icon: "item",
      },
      {
        id: "commerce",
        label: "Commerce",
        description: "Shops and crafting recipes",
        icon: "commerce",
      },
      {
        id: "economy",
        label: "Economy",
        description: "Simulation and balance",
        icon: "economy",
      },
      {
        id: "domains",
        label: "Domains",
        description: "Jobs, gangs, businesses",
        icon: "domain",
      },
    ],
  },
  {
    id: "world",
    label: "World",
    items: [
      {
        id: "zones",
        label: "Zones",
        description: "Interaction and territory zones",
        icon: "zone",
      },
      {
        id: "world",
        label: "World Tools",
        description: "Blips, props, and doors",
        icon: "world",
      },
      {
        id: "assets",
        label: "Assets",
        description: "Stream asset auditing",
        icon: "asset",
      },
      {
        id: "maps",
        label: "Maps / MLO",
        description: "Map packages and checklists",
        icon: "map",
      },
    ],
  },
  {
    id: "pipeline",
    label: "Pipeline",
    items: [
      {
        id: "releases",
        label: "Releases",
        description: "Bundles, diffs, checklists",
        icon: "release",
      },
      {
        id: "qa",
        label: "QA",
        description: "Scenario runs and regression",
        icon: "qa",
      },
      {
        id: "ci",
        label: "CI",
        description: "Validation gates and reports",
        icon: "ci",
      },
      {
        id: "security",
        label: "Security",
        description: "Audit findings and baseline",
        icon: "security",
      },
      {
        id: "performance",
        label: "Performance",
        description: "Snapshots and regressions",
        icon: "performance",
      },
    ],
  },
  {
    id: "build",
    label: "Build",
    items: [
      {
        id: "environment",
        label: "Environment",
        description: "server.cfg and txAdmin recipes",
        icon: "environment",
      },
      {
        id: "clothing",
        label: "Clothing",
        description: "Packs, conflicts, exports",
        icon: "clothing",
      },
      {
        id: "vehicles",
        label: "Vehicles",
        description: "Fleet packs and handling",
        icon: "vehicle",
      },
      {
        id: "nui",
        label: "NUI Bridge",
        description: "Schema sync and codegen",
        icon: "nui",
      },
      {
        id: "graph",
        label: "Dependency Graph",
        description: "Resource relationships",
        icon: "graph",
      },
      {
        id: "statebag",
        label: "State Bag",
        description: "Entity sync snapshots",
        icon: "statebag",
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
        ...(item.keywords ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    }),
  })).filter((group) => group.items.length > 0);
}
