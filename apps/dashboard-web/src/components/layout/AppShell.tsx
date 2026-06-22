import { useEffect, useState, type ReactNode } from "react";
import type { PageId } from "../../navigation";
import { findNavItem } from "../../navigation";
import type { WorkspaceWithConfig } from "../../types/api";
import { MenuIcon } from "../icons";
import Badge from "../ui/Badge";
import Sidebar from "./Sidebar";

interface AppShellProps {
  page: PageId;
  onNavigate: (page: PageId) => void;
  apiStatus: "loading" | "online" | "offline";
  workspaces: WorkspaceWithConfig[];
  activeWorkspaceId: string | null;
  workspacesLoading: boolean;
  selectingWorkspaceId: string | null;
  onSelectWorkspace: (id: string) => void;
  children: ReactNode;
}

function apiBadgeTone(status: AppShellProps["apiStatus"]) {
  switch (status) {
    case "online":
      return "success" as const;
    case "loading":
      return "warning" as const;
    default:
      return "danger" as const;
  }
}

function useStateFromStorage(key: string, defaultValue: boolean) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored === "true") return true;
      if (stored === "false") return false;
    } catch {
      /* ignore */
    }
    return defaultValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      /* ignore */
    }
  }, [key, value]);

  return [value, setValue] as const;
}

export default function AppShell({
  page,
  onNavigate,
  apiStatus,
  workspaces,
  activeWorkspaceId,
  workspacesLoading,
  selectingWorkspaceId,
  onSelectWorkspace,
  children,
}: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useStateFromStorage("fdt.sidebar.collapsed", false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const current = findNavItem(page);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);

  useEffect(() => {
    if (!mobileNavOpen) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileNavOpen]);

  return (
    <div className="app-shell">
      <div className="ambient-bg" aria-hidden="true">
        <div className="ambient-orb ambient-orb-a" />
        <div className="ambient-orb ambient-orb-b" />
        <div className="ambient-grid" />
      </div>

      <Sidebar
        page={page}
        onNavigate={onNavigate}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((prev) => !prev)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        apiStatus={apiStatus}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        workspacesLoading={workspacesLoading}
        selectingWorkspaceId={selectingWorkspaceId}
        onSelectWorkspace={onSelectWorkspace}
      />

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="icon-button mobile-nav-only"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
            >
              <MenuIcon />
            </button>
            <div className="topbar-heading">
              <p className="topbar-eyebrow">{current?.description ?? "Operations dashboard"}</p>
              <h1 className="topbar-title">{current?.label ?? "Dashboard"}</h1>
            </div>
          </div>
          <div className="topbar-right">
            {activeWorkspace && (
              <div className="topbar-workspace hidden sm:block">
                <span className="topbar-workspace-label">Workspace</span>
                <span className="topbar-workspace-value">{activeWorkspace.name}</span>
              </div>
            )}
            <Badge tone={apiBadgeTone(apiStatus)} className="lg:hidden">
              API {apiStatus}
            </Badge>
          </div>
        </header>

        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
