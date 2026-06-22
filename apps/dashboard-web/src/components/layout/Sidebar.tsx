import { memo, useCallback, useEffect, useMemo, useState } from "react";

import { prefetchPage } from "../../prefetchPage";

import type { PageId } from "../../navigation";

import { filterNavGroups, NAV_GROUPS } from "../../navigation";

import type { WorkspaceWithConfig } from "../../types/api";

import { ChevronIcon, CloseIcon, NavIconGlyph, SearchIcon } from "../icons";

import Badge from "../ui/Badge";

import WorkspaceSwitcher from "./WorkspaceSwitcher";



interface SidebarProps {

  page: PageId;

  onNavigate: (page: PageId) => void;

  collapsed: boolean;

  onToggleCollapsed: () => void;

  mobileOpen: boolean;

  onCloseMobile: () => void;

  apiStatus: "loading" | "online" | "offline";

  workspaces: WorkspaceWithConfig[];

  activeWorkspaceId: string | null;

  workspacesLoading: boolean;

  selectingWorkspaceId: string | null;

  onSelectWorkspace: (id: string) => void;

}



function apiBadgeTone(status: SidebarProps["apiStatus"]) {

  switch (status) {

    case "online":

      return "success" as const;

    case "loading":

      return "warning" as const;

    default:

      return "danger" as const;

  }

}



function SidebarComponent({

  page,

  onNavigate,

  collapsed,

  onToggleCollapsed,

  mobileOpen,

  onCloseMobile,

  apiStatus,

  workspaces,

  activeWorkspaceId,

  workspacesLoading,

  selectingWorkspaceId,

  onSelectWorkspace,

}: SidebarProps) {

  const [query, setQuery] = useState("");

  const groups = useMemo(() => filterNavGroups(query), [query]);

  const visibleGroups = query ? groups : NAV_GROUPS;



  const handleNavigate = useCallback(

    (nextPage: PageId) => {

      onNavigate(nextPage);

      onCloseMobile();

      setQuery("");

    },

    [onNavigate, onCloseMobile],

  );



  const handleManageWorkspaces = useCallback(() => {

    handleNavigate("workspaces");

  }, [handleNavigate]);



  const handlePrefetchPage = useCallback((nextPage: PageId) => {

    prefetchPage(nextPage);

  }, []);



  useEffect(() => {

    if (!mobileOpen) {

      return;

    }

    const onKeyDown = (event: KeyboardEvent) => {

      if (event.key === "Escape") {

        onCloseMobile();

      }

    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);

  }, [mobileOpen, onCloseMobile]);



  return (

    <>

      <div

        className={`sidebar-backdrop ${mobileOpen ? "sidebar-backdrop-visible" : ""}`}

        onClick={onCloseMobile}

        aria-hidden="true"

      />

      <aside

        className={`sidebar ${collapsed ? "sidebar-collapsed" : ""} ${mobileOpen ? "sidebar-mobile-open" : ""}`}

        aria-label="Application sidebar"

      >

        <div className="sidebar-header">

          <div className="sidebar-brand">

            <div className="brand-mark" aria-hidden="true">

              <span />

              <span />

            </div>

            {!collapsed && (

              <div className="min-w-0 flex-1">

                <p className="brand-kicker">FiveM</p>

                <p className="brand-title">DevOps Toolkit</p>

              </div>

            )}

            <button

              type="button"

              className="icon-button sidebar-close mobile-nav-only"

              onClick={onCloseMobile}

              aria-label="Close navigation"

            >

              <CloseIcon />

            </button>

          </div>



          {!collapsed && (

            <div className="sidebar-search">

              <span className="sidebar-search-icon" aria-hidden="true">

                <SearchIcon />

              </span>

              <input

                type="search"

                value={query}

                onChange={(event) => setQuery(event.target.value)}

                placeholder="Filter modules…"

                aria-label="Filter navigation"

                autoComplete="off"

                spellCheck={false}

              />

            </div>

          )}

        </div>



        <nav className="sidebar-nav" aria-label="Primary">

          {visibleGroups.length === 0 ? (

            <p className="sidebar-empty">No modules match your filter.</p>

          ) : (

            visibleGroups.map((group) => (

              <div key={group.id} className="nav-group">

                {!collapsed && <p className="nav-group-label">{group.label}</p>}

                <ul className="nav-list">

                  {group.items.map((item) => {

                    const active = page === item.id;

                    return (

                      <li key={item.id}>

                        <button

                          type="button"

                          title={collapsed ? item.label : undefined}

                          aria-current={active ? "page" : undefined}

                          className={`nav-item ${active ? "nav-item-active" : ""}`}

                          onClick={() => handleNavigate(item.id)}

                          onMouseEnter={() => handlePrefetchPage(item.id)}

                          onFocus={() => handlePrefetchPage(item.id)}

                        >

                          <span className="nav-item-icon">

                            <NavIconGlyph icon={item.icon} size="sm" />

                          </span>

                          {!collapsed && (

                            <span className="nav-item-copy">

                              <span className="nav-item-label">{item.label}</span>

                              <span className="nav-item-desc">{item.description}</span>

                            </span>

                          )}

                        </button>

                      </li>

                    );

                  })}

                </ul>

              </div>

            ))

          )}

        </nav>



        <div className="sidebar-footer">

          <WorkspaceSwitcher

            collapsed={collapsed}

            workspaces={workspaces}

            activeWorkspaceId={activeWorkspaceId}

            loading={workspacesLoading}

            selectingId={selectingWorkspaceId}

            onSelect={onSelectWorkspace}

            onManage={handleManageWorkspaces}

          />

          <div className={`sidebar-status ${collapsed ? "justify-center" : ""}`}>

            <Badge tone={apiBadgeTone(apiStatus)}>{collapsed ? "API" : `API ${apiStatus}`}</Badge>

            <button

              type="button"

              className="icon-button desktop-nav-only"

              onClick={onToggleCollapsed}

              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}

            >

              <ChevronIcon expanded={!collapsed} className="rotate-[-90deg]" />

            </button>

          </div>

        </div>

      </aside>

    </>

  );

}



export default memo(SidebarComponent);

