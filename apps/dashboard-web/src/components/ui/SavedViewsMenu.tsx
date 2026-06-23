import { useEffect, useId, useRef, useState } from "react";
import type { SavedTableView } from "../../hooks/useTableFilter";
import { ChevronIcon } from "../icons";

interface SavedViewsMenuProps {
  views: SavedTableView[];
  onApply: (view: SavedTableView) => void;
  onSave: (label: string) => boolean;
  onDelete: (id: string) => void;
}

export default function SavedViewsMenu({ views, onApply, onSave, onDelete }: SavedViewsMenuProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setSaving(false);
        setLabel("");
        setError(null);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setSaving(false);
        setLabel("");
        setError(null);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    const ok = onSave(label);
    if (!ok) {
      setError("Enter a unique name for this view.");
      return;
    }
    setLabel("");
    setSaving(false);
    setError(null);
  }

  return (
    <div className={`saved-views ${open ? "saved-views-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="btn btn-secondary btn-sm saved-views-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        Views
        {views.length > 0 && <span className="saved-views-count">{views.length}</span>}
        <ChevronIcon expanded={open} size="sm" />
      </button>

      {open && (
        <div className="saved-views-menu" role="menu" aria-label="Saved table views">
          {views.length === 0 && !saving && (
            <p className="saved-views-empty">No saved views yet.</p>
          )}

          {views.length > 0 && (
            <ul className="saved-views-list">
              {views.map((view) => (
                <li key={view.id}>
                  <button
                    type="button"
                    role="menuitem"
                    className="saved-views-item"
                    onClick={() => {
                      onApply(view);
                      setOpen(false);
                    }}
                  >
                    <span className="saved-views-item-label">{view.label}</span>
                    {view.query && (
                      <span className="saved-views-item-query">&ldquo;{view.query}&rdquo;</span>
                    )}
                  </button>
                  <button
                    type="button"
                    className="saved-views-delete"
                    aria-label={`Delete view ${view.label}`}
                    onClick={() => onDelete(view.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          {saving ? (
            <form className="saved-views-save" onSubmit={handleSave}>
              <label className="sr-only" htmlFor={inputId}>
                View name
              </label>
              <input
                id={inputId}
                value={label}
                onChange={(event) => {
                  setLabel(event.target.value);
                  setError(null);
                }}
                placeholder="View name…"
                className="form-control"
                autoFocus
              />
              {error && <p className="saved-views-error">{error}</p>}
              <div className="saved-views-save-actions">
                <button type="submit" className="btn btn-accent btn-sm">
                  Save
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setSaving(false);
                    setLabel("");
                    setError(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              className="saved-views-add"
              onClick={() => setSaving(true)}
            >
              Save current filter…
            </button>
          )}
        </div>
      )}
    </div>
  );
}
