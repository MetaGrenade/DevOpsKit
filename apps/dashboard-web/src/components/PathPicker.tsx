import { useEffect, useState } from "react";

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
    <div className="block text-sm">
      <span className="text-slate-300">{label}</span>
      <div className="mt-1 flex gap-2">
        <input
          required={required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2 font-mono text-xs"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-xs text-slate-100 hover:bg-white/15"
        >
          Browse
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-[#111831] shadow-2xl">
            <div className="border-b border-white/10 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-medium">
                  {mode === "file" ? "Select file" : "Select folder"}
                </h4>
                <div className="flex items-center gap-2">
                  {!atRoots && (
                    <button
                      type="button"
                      onClick={() => loadListing(FILESYSTEM_ROOTS_PATH).catch(() => undefined)}
                      className="rounded-lg bg-white/10 px-2 py-1 text-xs text-slate-200 hover:bg-white/15"
                    >
                      All drives
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-white/5 hover:text-white"
                  >
                    Close
                  </button>
                </div>
              </div>
              <p className="mt-1 truncate font-mono text-xs text-slate-400">
                {atRoots ? "Choose a drive or location" : currentPath || "Loading…"}
              </p>
              <div className="mt-2 flex flex-wrap gap-1 text-xs">
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
                    className="rounded bg-white/5 px-2 py-1 text-slate-300 hover:bg-white/10"
                  >
                    {segment}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[50vh] overflow-y-auto px-2 py-2">
              {loading && <p className="px-2 py-3 text-sm text-slate-400">Loading folder…</p>}
              {error && <p className="px-2 py-3 text-sm text-rose-300">{error}</p>}

              {!loading && listing && (
                <ul className="space-y-1">
                  {listing.parent && (
                    <li>
                      <button
                        type="button"
                        onClick={() => loadListing(listing.parent!).catch(() => undefined)}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5"
                      >
                        <span className="text-slate-400">..</span>
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
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5"
                      >
                        <span className="truncate">
                          <span className="text-slate-500">{entry.type === "directory" ? "[Dir]" : "[File]"}</span>{" "}
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
                            className="shrink-0 rounded bg-cyan-500/20 px-2 py-1 text-xs text-cyan-200"
                          >
                            Select
                          </span>
                        )}
                        {entry.type === "file" && mode === "file" && (
                          <span className="shrink-0 text-xs text-cyan-300">Select</span>
                        )}
                      </button>
                    </li>
                  ))}

                  {listing.entries.length === 0 && (
                    <li className="px-3 py-4 text-sm text-slate-400">
                      {atRoots ? "No drives found." : "This folder is empty."}
                    </li>
                  )}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
              <p className="truncate font-mono text-xs text-slate-500">
                {atRoots ? "All drives" : currentPath}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
                >
                  Cancel
                </button>
                {mode === "directory" && currentPath && !atRoots && (
                  <button
                    type="button"
                    onClick={() => handleSelect(currentPath)}
                    className="rounded-lg bg-cyan-500/20 px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-500/30"
                  >
                    Select this folder
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
