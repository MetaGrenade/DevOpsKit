import { memo, useCallback, useEffect, useId, useRef, useState } from "react";
import { shortenPath } from "../../lib/workspaces";
import type { WorkspaceWithConfig } from "../../types/api";
import { ChevronIcon, NavIconGlyph } from "../icons";

interface WorkspaceSwitcherProps {
  collapsed: boolean;
  workspaces: WorkspaceWithConfig[];
  activeWorkspaceId: string | null;
  loading: boolean;
  selectingId: string | null;
  onSelect: (id: string) => void;
  onManage: () => void;
}

function WorkspaceSwitcherComponent({
  collapsed,
  workspaces,
  activeWorkspaceId,
  loading,
  selectingId,
  onSelect,
  onManage,
}: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const active = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        close();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  const handleSelect = (id: string) => {
    if (id === activeWorkspaceId || selectingId) {
      close();
      return;
    }
    onSelect(id);
    close();
  };

  const menu = (
    <div className="workspace-switcher-menu" id={listId} role="listbox" aria-label="Registered workspaces">
      {workspaces.length === 0 ? (
        <p className="workspace-switcher-empty">No workspaces registered yet.</p>
      ) : (
        <ul className="workspace-switcher-list">
          {workspaces.map((workspace) => {
            const isActive = workspace.id === activeWorkspaceId;
            const isSelecting = selectingId === workspace.id;
            return (
              <li key={workspace.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={`workspace-switcher-item ${isActive ? "workspace-switcher-item-active" : ""}`}
                  disabled={Boolean(selectingId)}
                  onClick={() => handleSelect(workspace.id)}
                >
                  <span className="workspace-switcher-item-indicator" aria-hidden="true">
                    {isSelecting ? <span className="workspace-switcher-spinner" /> : isActive ? "●" : "○"}
                  </span>
                  <span className="workspace-switcher-item-copy">
                    <span className="workspace-switcher-item-name">{workspace.name}</span>
                    <span className="workspace-switcher-item-path">{shortenPath(workspace.directory)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <button type="button" className="workspace-switcher-manage" onClick={() => { close(); onManage(); }}>
        Manage workspaces
      </button>
    </div>
  );

  if (collapsed) {
    return (
      <div className="workspace-switcher workspace-switcher-collapsed" ref={rootRef}>
        <button
          type="button"
          className="icon-button workspace-switcher-icon"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={active ? `Active workspace: ${active.name}. Switch workspace` : "Switch workspace"}
          title={active?.name ?? "Switch workspace"}
          onClick={() => setOpen((value) => !value)}
        >
          <NavIconGlyph icon="workspace" size="sm" />
        </button>
        {open && <div className="workspace-switcher-popover">{menu}</div>}
      </div>
    );
  }

  return (
    <div className={`workspace-switcher ${open ? "workspace-switcher-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="workspace-switcher-trigger"
        aria-expanded={open}
        aria-controls={listId}
        disabled={loading && !active}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="workspace-switcher-trigger-copy">
          <span className="workspace-switcher-label">Active workspace</span>
          <span className="workspace-switcher-name">
            {loading && !active ? "Loading…" : active?.name ?? "No workspace selected"}
          </span>
          {active && <span className="workspace-switcher-path">{shortenPath(active.directory, 42)}</span>}
        </span>
        <ChevronIcon expanded={open} className="workspace-switcher-chevron" />
      </button>
      {open && menu}
    </div>
  );
}

export default memo(WorkspaceSwitcherComponent);
