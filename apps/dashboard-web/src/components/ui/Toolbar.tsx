import type { ReactNode } from "react";
import { SearchIcon } from "../icons";

interface ToolbarProps {
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    ariaLabel?: string;
  };
  count?: ReactNode;
  children?: ReactNode;
}

export default function Toolbar({ search, count, children }: ToolbarProps) {
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
        {count !== undefined && <span className="toolbar-count">{count}</span>}
      </div>
      {children && <div className="toolbar-actions">{children}</div>}
    </div>
  );
}
