import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "./components/layout/AppShell";
import PageLoader from "./components/ui/PageLoader";
import { fetchWorkspaces, findActiveWorkspace, selectWorkspace as selectWorkspaceApi } from "./lib/workspaces";
import type { PageId } from "./navigation";
import OverviewPage from "./pages/OverviewPage";
import type { WorkspaceWithConfig } from "./types/api";

const WorkspacesPage = lazy(() => import("./pages/WorkspacesPage"));
const ResourcesPage = lazy(() => import("./pages/ResourcesPage"));
const ItemsPage = lazy(() => import("./pages/ItemsPage"));
const AssetsPage = lazy(() => import("./pages/AssetsPage"));
const ZonesPage = lazy(() => import("./pages/ZonesPage"));
const ReleasesPage = lazy(() => import("./pages/ReleasesPage"));
const SecurityPage = lazy(() => import("./pages/SecurityPage"));
const QaPage = lazy(() => import("./pages/QaPage"));
const CiPage = lazy(() => import("./pages/CiPage"));
const DomainsPage = lazy(() => import("./pages/DomainsPage"));
const PerformancePage = lazy(() => import("./pages/PerformancePage"));
const ClothingPage = lazy(() => import("./pages/ClothingPage"));
const VehiclesPage = lazy(() => import("./pages/VehiclesPage"));
const MapsPage = lazy(() => import("./pages/MapsPage"));
const GraphPage = lazy(() => import("./pages/GraphPage"));
const NuiPage = lazy(() => import("./pages/NuiPage"));
const EconomyPage = lazy(() => import("./pages/EconomyPage"));
const CommercePage = lazy(() => import("./pages/CommercePage"));
const WorldPage = lazy(() => import("./pages/WorldPage"));
const EnvironmentPage = lazy(() => import("./pages/EnvironmentPage"));
const StateBagPage = lazy(() => import("./pages/StateBagPage"));
const DocsPage = lazy(() => import("./pages/DocsPage"));
const ApiDocsPage = lazy(() => import("./pages/ApiDocsPage"));

interface OverviewModule {
  id: string;
  status: string;
}

interface OverviewResponse {
  name: string;
  phase: string;
  modules: OverviewModule[];
}

export default function App() {
  const [page, setPage] = useState<PageId>("overview");
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceWithConfig[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [workspacesLoading, setWorkspacesLoading] = useState(true);
  const [selectingWorkspaceId, setSelectingWorkspaceId] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<"loading" | "online" | "offline">("loading");
  const [workspaceVersion, setWorkspaceVersion] = useState(0);

  const activeWorkspace = useMemo(
    () => findActiveWorkspace(workspaces, activeWorkspaceId),
    [workspaces, activeWorkspaceId],
  );

  const refreshWorkspaces = useCallback(() => {
    setWorkspaceVersion((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/v1/overview", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("API unavailable");
        return res.json() as Promise<OverviewResponse>;
      })
      .then((data) => {
        setOverview(data);
        setApiStatus("online");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setApiStatus("offline");
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setWorkspacesLoading(true);

    fetchWorkspaces()
      .then((data) => {
        if (!cancelled) {
          setWorkspaces(data.workspaces);
          setActiveWorkspaceId(data.activeWorkspaceId);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspaces([]);
          setActiveWorkspaceId(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setWorkspacesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceVersion]);

  const handleSelectWorkspace = useCallback(
    async (id: string) => {
      if (id === activeWorkspaceId) {
        return;
      }

      setSelectingWorkspaceId(id);
      try {
        const workspace = await selectWorkspaceApi(id);
        setActiveWorkspaceId(workspace.id);
        refreshWorkspaces();
      } catch {
        refreshWorkspaces();
      } finally {
        setSelectingWorkspaceId(null);
      }
    },
    [activeWorkspaceId, refreshWorkspaces],
  );

  const handleNavigate = useCallback(
    (nextPage: PageId) => {
      setPage(nextPage);
      if (nextPage === "workspaces") {
        refreshWorkspaces();
      }
    },
    [refreshWorkspaces],
  );

  const workspaceScopeKey = activeWorkspaceId ?? "no-workspace";

  return (
    <AppShell
      page={page}
      onNavigate={handleNavigate}
      apiStatus={apiStatus}
      workspaces={workspaces}
      activeWorkspaceId={activeWorkspaceId}
      workspacesLoading={workspacesLoading}
      selectingWorkspaceId={selectingWorkspaceId}
      onSelectWorkspace={handleSelectWorkspace}
    >
      {page === "overview" && (
        <OverviewPage
          key={workspaceScopeKey}
          overview={overview}
          apiStatus={apiStatus}
          workspaceName={activeWorkspace?.name}
          onNavigate={handleNavigate}
        />
      )}

      <Suspense fallback={<PageLoader />}>
        {page === "workspaces" && (
          <WorkspacesPage key={workspaceScopeKey} onWorkspaceChanged={refreshWorkspaces} />
        )}
        {page === "resources" && <ResourcesPage key={workspaceScopeKey} />}
        {page === "items" && <ItemsPage key={workspaceScopeKey} />}
        {page === "commerce" && <CommercePage key={workspaceScopeKey} />}
        {page === "economy" && <EconomyPage key={workspaceScopeKey} />}
        {page === "statebag" && <StateBagPage key={workspaceScopeKey} />}
        {page === "assets" && <AssetsPage key={workspaceScopeKey} />}
        {page === "zones" && <ZonesPage key={workspaceScopeKey} />}
        {page === "world" && <WorldPage key={workspaceScopeKey} />}
        {page === "environment" && <EnvironmentPage key={workspaceScopeKey} />}
        {page === "releases" && <ReleasesPage key={workspaceScopeKey} />}
        {page === "security" && <SecurityPage key={workspaceScopeKey} />}
        {page === "qa" && <QaPage key={workspaceScopeKey} />}
        {page === "ci" && <CiPage key={workspaceScopeKey} />}
        {page === "domains" && <DomainsPage key={workspaceScopeKey} />}
        {page === "performance" && <PerformancePage key={workspaceScopeKey} />}
        {page === "clothing" && <ClothingPage key={workspaceScopeKey} />}
        {page === "vehicles" && <VehiclesPage key={workspaceScopeKey} />}
        {page === "maps" && <MapsPage key={workspaceScopeKey} />}
        {page === "graph" && <GraphPage key={workspaceScopeKey} />}
        {page === "nui" && <NuiPage key={workspaceScopeKey} />}
        {page === "docs" && <DocsPage onNavigate={handleNavigate} />}
        {page === "api-docs" && <ApiDocsPage />}
      </Suspense>
    </AppShell>
  );
}
