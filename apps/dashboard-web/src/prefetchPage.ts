import type { PageId } from "./navigation";

const PAGE_LOADERS: Partial<Record<PageId, () => Promise<unknown>>> = {
  workspaces: () => import("./pages/WorkspacesPage"),
  resources: () => import("./pages/ResourcesPage"),
  items: () => import("./pages/ItemsPage"),
  assets: () => import("./pages/AssetsPage"),
  zones: () => import("./pages/ZonesPage"),
  releases: () => import("./pages/ReleasesPage"),
  security: () => import("./pages/SecurityPage"),
  qa: () => import("./pages/QaPage"),
  ci: () => import("./pages/CiPage"),
  domains: () => import("./pages/DomainsPage"),
  performance: () => import("./pages/PerformancePage"),
  clothing: () => import("./pages/ClothingPage"),
  vehicles: () => import("./pages/VehiclesPage"),
  maps: () => import("./pages/MapsPage"),
  graph: () => import("./pages/GraphPage"),
  nui: () => import("./pages/NuiPage"),
  economy: () => import("./pages/EconomyPage"),
  commerce: () => import("./pages/CommercePage"),
  world: () => import("./pages/WorldPage"),
  environment: () => import("./pages/EnvironmentPage"),
  statebag: () => import("./pages/StateBagPage"),
};

export function prefetchPage(page: PageId): void {
  PAGE_LOADERS[page]?.();
}
