import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

export const FILESYSTEM_ROOTS_PATH = "__fdt_roots__";

export type BrowseMode = "directory" | "file" | "all";
export type BrowseScope = "roots" | "directory";

export interface BrowseEntry {
  name: string;
  path: string;
  type: "directory" | "file";
}

export interface BrowseDirectoryResult {
  path: string;
  parent: string | null;
  scope: BrowseScope;
  entries: BrowseEntry[];
}

export function isFilesystemRootsPath(inputPath: string): boolean {
  return inputPath === FILESYSTEM_ROOTS_PATH;
}

export function getFilesystemRoots(): Array<{ path: string; label: string }> {
  if (process.platform === "win32") {
    const roots: Array<{ path: string; label: string }> = [];
    for (let code = 65; code <= 90; code += 1) {
      const drive = `${String.fromCharCode(code)}:\\`;
      if (existsSync(drive)) {
        roots.push({ path: drive, label: `Local Disk (${drive})` });
      }
    }
    return roots;
  }

  return [{ path: "/", label: "Filesystem root (/)" }];
}

function normalizeDirectoryPath(inputPath: string): string {
  if (/^[A-Za-z]:$/.test(inputPath)) {
    return `${inputPath}\\`;
  }

  return path.resolve(inputPath);
}

function isDriveRoot(resolvedPath: string): boolean {
  return getFilesystemRoots().some((root) => normalizeDirectoryPath(root.path) === resolvedPath);
}

function shouldShowDrivePicker(): boolean {
  return process.platform === "win32" && getFilesystemRoots().length > 1;
}

export function getParentPath(currentPath: string): string | null {
  if (isFilesystemRootsPath(currentPath)) {
    return null;
  }

  const resolved = normalizeDirectoryPath(currentPath);

  if (isDriveRoot(resolved)) {
    return shouldShowDrivePicker() ? FILESYSTEM_ROOTS_PATH : null;
  }

  const parent = path.dirname(resolved);
  if (parent === resolved) {
    return shouldShowDrivePicker() ? FILESYSTEM_ROOTS_PATH : null;
  }

  return parent;
}

function matchesFileFilter(name: string, extensions?: string[]): boolean {
  if (!extensions || extensions.length === 0) {
    return true;
  }

  const lower = name.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext.toLowerCase()));
}

export async function browseFilesystemRoots(): Promise<BrowseDirectoryResult> {
  const roots = getFilesystemRoots();

  return {
    path: FILESYSTEM_ROOTS_PATH,
    parent: null,
    scope: "roots",
    entries: roots.map((root) => ({
      name: root.label,
      path: normalizeDirectoryPath(root.path),
      type: "directory",
    })),
  };
}

export async function browseDirectory(
  inputPath: string | undefined,
  mode: BrowseMode = "directory",
  fileExtensions?: string[],
): Promise<BrowseDirectoryResult> {
  if (!inputPath || isFilesystemRootsPath(inputPath)) {
    if (shouldShowDrivePicker() || !inputPath) {
      return browseFilesystemRoots();
    }

    const roots = getFilesystemRoots();
    inputPath = roots[0]?.path;
  }

  if (!inputPath) {
    throw new Error("No filesystem root available");
  }

  const resolved = normalizeDirectoryPath(inputPath);

  if (!existsSync(resolved)) {
    throw new Error(`Path not found: ${resolved}`);
  }

  const stats = await stat(resolved);
  if (!stats.isDirectory()) {
    throw new Error(`Not a directory: ${resolved}`);
  }

  const dirents = await readdir(resolved, { withFileTypes: true });
  const entries: BrowseEntry[] = [];

  for (const dirent of dirents) {
    const entryPath = path.join(resolved, dirent.name);

    if (dirent.isDirectory()) {
      entries.push({ name: dirent.name, path: entryPath, type: "directory" });
      continue;
    }

    if (!dirent.isFile()) {
      continue;
    }

    if (mode === "directory") {
      continue;
    }

    if (mode === "file" && !matchesFileFilter(dirent.name, fileExtensions)) {
      continue;
    }

    entries.push({ name: dirent.name, path: entryPath, type: "file" });
  }

  entries.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "directory" ? -1 : 1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  return {
    path: resolved,
    parent: getParentPath(resolved),
    scope: "directory",
    entries,
  };
}
