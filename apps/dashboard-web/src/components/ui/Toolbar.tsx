import type { ReactNode } from "react";
import { SearchIcon } from "../icons";
import SavedViewsMenu from "./SavedViewsMenu";
import type { SavedTableView } from "../../hooks/useTableFilter";

interface ToolbarProps {
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    ariaLabel?: string;
  };
  views?: {
    items: SavedTableView[];
    onApply: (view: SavedTableView) => void;
    onSave: (label: string) => boolean;
    onDelete: (id: string) => void;
  };
  count?: ReactNode;
  children?: ReactNode;
}

export default function Toolbar({ search, views, count, children }: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar-lead">
        {search && (
          <div className="toolbar-search">
            <span className="toolbar-search-icon" aria-hidden="true">
              <SearchIcon size="sm" />
            </span>
            <input
              type="search"
              value={search.value}
              onChange={(event) => search.onChange(event.target.value)}
              placeholder={search.placeholder ?? "Filter…"}
              aria-label={search.ariaLabel ?? "Filter rows"}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        )}
        {views && (
          <SavedViewsMenu
            views={views.items}
            onApply={views.onApply}
            onSave={views.onSave}
            onDelete={views.onDelete}
          />
        )}
        {count !== undefined && <span className="toolbar-count">{count}</span>}
      </div>
      {children && <div className="toolbar-actions">{children}</div>}
    </div>
  );
}
