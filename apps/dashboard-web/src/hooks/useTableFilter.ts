import { useCallback, useEffect, useState } from "react";

export interface SavedTableView {
  id: string;
  label: string;
  query: string;
  createdAt: number;
}

const FILTER_PREFIX = "fdt.table-filter.";
const VIEWS_PREFIX = "fdt.table-views.";

function readFilter(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeFilter(key: string, value: string): void {
  try {
    if (value.trim()) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    /* ignore quota / private mode */
  }
}

function readViews(key: string): SavedTableView[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedTableView[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeViews(key: string, views: SavedTableView[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(views));
  } catch {
    /* ignore */
  }
}

export function useTableFilter(scope: string) {
  const filterKey = `${FILTER_PREFIX}${scope}`;
  const viewsKey = `${VIEWS_PREFIX}${scope}`;

  const [query, setQueryState] = useState(() => readFilter(filterKey));
  const [views, setViews] = useState<SavedTableView[]>(() => readViews(viewsKey));

  useEffect(() => {
    writeFilter(filterKey, query);
  }, [filterKey, query]);

  const setQuery = useCallback((value: string) => {
    setQueryState(value);
  }, []);

  const saveView = useCallback(
    (label: string) => {
      const trimmed = label.trim();
      if (!trimmed) return false;

      const duplicate = views.some((view) => view.label.toLowerCase() === trimmed.toLowerCase());
      if (duplicate) return false;

      const view: SavedTableView = {
        id: crypto.randomUUID(),
        label: trimmed,
        query,
        createdAt: Date.now(),
      };

      setViews((current) => {
        const next = [...current, view];
        writeViews(viewsKey, next);
        return next;
      });
      return true;
    },
    [query, views, viewsKey],
  );

  const applyView = useCallback((view: SavedTableView) => {
    setQueryState(view.query);
  }, []);

  const deleteView = useCallback(
    (id: string) => {
      setViews((current) => {
        const next = current.filter((view) => view.id !== id);
        writeViews(viewsKey, next);
        return next;
      });
    },
    [viewsKey],
  );

  return { query, setQuery, views, saveView, applyView, deleteView };
}

export type TableFilterViews = Pick<
  ReturnType<typeof useTableFilter>,
  "views" | "saveView" | "applyView" | "deleteView"
>;
