import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

export function resolveResourceDirectory(
  workspaceRoot: string,
  resourcesRoot: string,
  resourceName: string,
): { resourceRoot: string; resourcePath: string } | null {
  const resourcesAbs = path.resolve(workspaceRoot, resourcesRoot);
  const direct = path.join(resourcesAbs, resourceName);
  if (existsSync(direct)) {
    return {
      resourceRoot: direct,
      resourcePath: normalizePath(path.relative(workspaceRoot, direct)),
    };
  }

  if (!existsSync(resourcesAbs)) {
    return null;
  }

  for (const entry of readdirSync(resourcesAbs, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith("[") || !entry.name.endsWith("]")) {
      continue;
    }

    const nested = path.join(resourcesAbs, entry.name, resourceName);
    if (existsSync(nested)) {
      return {
        resourceRoot: nested,
        resourcePath: normalizePath(path.relative(workspaceRoot, nested)),
      };
    }
  }

  return null;
}
