import { useEffect, useState } from "react";
import { PageAlert } from "./ui/page";

type BrowseMode = "directory" | "file";

const FILESYSTEM_ROOTS_PATH = "__fdt_roots__";

interface BrowseEntry {
  name: string;
  path: string;
  type: "directory" | "file";
}

interface BrowseListing {
  path: string;
  parent: string | null;
  scope?: "roots" | "directory";
  entries: BrowseEntry[];
}

interface PathPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mode?: BrowseMode;
  fileExtensions?: string[];
  placeholder?: string;
  required?: boolean;
}

function splitBreadcrumb(currentPath: string, scope?: BrowseListing["scope"]): string[] {
  if (scope === "roots" || currentPath === FILESYSTEM_ROOTS_PATH) {
    return ["This PC"];
  }

  if (!currentPath) {
    return [];
  }

  const normalized = currentPath.replace(/\\/g, "/");
  if (/^[A-Za-z]:\/?$/.test(normalized)) {
    return ["This PC", normalized.replace(/\//, "")];
  }

  const parts = normalized.split("/").filter(Boolean);
  if (/^[A-Za-z]:$/.test(parts[0] ?? "")) {
    return ["This PC", parts[0]!, ...parts.slice(1)];
  }

  return parts.length > 0 ? ["This PC", "/", ...parts.slice(1)] : ["This PC"];
}

function buildBreadcrumbPath(segments: string[], index: number): string | undefined {
  const segment = segments[index];
  if (segment === "This PC") {
    return FILESYSTEM_ROOTS_PATH;
  }

  const drive = segments[1];
  if (!drive || !/^[A-Za-z]:$/.test(drive)) {
    return segment === "/" ? "/" : undefined;
  }

  if (index === 1) {
    return `${drive}\\`;
  }

  const rest = segments.slice(2, index + 1).join("\\");
  return rest ? `${drive}\\${rest}` : `${drive}\\`;
}

export default function PathPicker({
  label,
  value,
  onChange,
  mode = "directory",
  fileExtensions,
  placeholder,
  required = false,
}: PathPickerProps) {
  const [open, setOpen] = useState(false);
  const [listing, setListing] = useState<BrowseListing | null>(null);
  const [currentPath, setCurrentPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadListing(path?: string) {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ mode: mode === "file" ? "all" : "directory" });
    if (path) {
      params.set("path", path);
    }
    if (mode === "file" && fileExtensions?.length) {
      params.set("extensions", fileExtensions.join(","));
    }

    const response = await fetch(`/api/v1/fs/list?${params.toString()}`);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message ?? "Failed to browse path");
    }

    setListing(payload as BrowseListing);
    setCurrentPath(payload.path);
    setLoading(false);
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    const initialPath = value && value.trim().length > 0 ? value : FILESYSTEM_ROOTS_PATH;
    loadListing(initialPath).catch((browseError) => {
      loadListing(FILESYSTEM_ROOTS_PATH).catch(() => {
        setError(browseError instanceof Error ? browseError.message : "Failed to browse path");
        setLoading(false);
      });
    });
  }, [open]);

  function handleSelect(selectedPath: string) {
    onChange(selectedPath);
    setOpen(false);
  }

  const breadcrumbs = splitBreadcrumb(currentPath, listing?.scope);
  const atRoots = listing?.scope === "roots";

  return (
    <label className="form-field">
      <span className="form-label">{label}</span>
      <div className="flex gap-2">
        <input
          required={required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="form-control form-control-mono min-w-0 flex-1"
          placeholder={placeholder}
        />
        <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary btn-sm shrink-0">
          Browse
        </button>
      </div>

      {open && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div className="modal-header">
              <div className="min-w-0 flex-1">
                <h4 className="panel-heading">{mode === "file" ? "Select file" : "Select folder"}</h4>
                <p className="panel-subtext truncate">
                  {atRoots ? "Choose a drive or location" : currentPath || "Loading…"}
                </p>
                <div className="breadcrumb-row">
                  {breadcrumbs.map((segment, index) => (
                    <button
                      key={`${segment}-${index}`}
                      type="button"
                      onClick={() => {
                        const target = buildBreadcrumbPath(breadcrumbs, index);
                        if (target) {
                          loadListing(target).catch(() => undefined);
                        }
                      }}
                      className="breadcrumb-chip"
                    >
                      {segment}
                    </button>
                  ))}
                </div>
              </div>
              <div className="btn-row" style={{ marginTop: 0 }}>
                {!atRoots && (
                  <button
                    type="button"
                    onClick={() => loadListing(FILESYSTEM_ROOTS_PATH).catch(() => undefined)}
                    className="btn btn-secondary btn-sm"
                  >
                    All drives
                  </button>
                )}
                <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary btn-sm">
                  Close
                </button>
              </div>
            </div>

            <div className="modal-body">
              {loading && <p className="panel-subtext px-2 py-3">Loading folder…</p>}
              {error && <PageAlert variant="error">{error}</PageAlert>}

              {!loading && listing && (
                <ul className="browse-list">
                  {listing.parent && (
                    <li>
                      <button
                        type="button"
                        onClick={() => loadListing(listing.parent!).catch(() => undefined)}
                        className="browse-item"
                      >
                        <span className="text-[var(--color-muted)]">..</span>
                        <span>{listing.parent === FILESYSTEM_ROOTS_PATH ? "All drives" : "Parent folder"}</span>
                      </button>
                    </li>
                  )}

                  {listing.entries.map((entry) => (
                    <li key={entry.path}>
                      <button
                        type="button"
                        onClick={() => {
                          if (entry.type === "directory") {
                            loadListing(entry.path).catch(() => undefined);
                            return;
                          }

                          if (mode === "file") {
                            handleSelect(entry.path);
                          }
                        }}
                        className="browse-item"
                      >
                        <span className="truncate">
                          <span className="text-[var(--color-muted)]">
                            {entry.type === "directory" ? "[Dir]" : "[File]"}
                          </span>{" "}
                          {entry.name}
                        </span>
                        {entry.type === "directory" && mode === "directory" && !atRoots && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleSelect(entry.path);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                event.stopPropagation();
                                handleSelect(entry.path);
                              }
                            }}
                            className="btn btn-accent btn-sm shrink-0"
                          >
                            Select
                          </span>
                        )}
                        {entry.type === "file" && mode === "file" && (
                          <span className="text-xs text-[var(--color-accent-ink)] shrink-0">Select</span>
                        )}
                      </button>
                    </li>
                  ))}

                  {listing.entries.length === 0 && (
                    <li className="panel-subtext px-3 py-4">
                      {atRoots ? "No drives found." : "This folder is empty."}
                    </li>
                  )}
                </ul>
              )}
            </div>

            <div className="modal-footer">
              <p className="panel-subtext truncate font-mono">{atRoots ? "All drives" : currentPath}</p>
              <div className="btn-row" style={{ marginTop: 0 }}>
                <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                {mode === "directory" && currentPath && !atRoots && (
                  <button
                    type="button"
                    onClick={() => handleSelect(currentPath)}
                    className="btn btn-primary btn-sm"
                  >
                    Select this folder
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </label>
  );
}
