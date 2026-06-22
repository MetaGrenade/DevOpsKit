import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MONOREPO_MARKERS = ["pnpm-workspace.yaml", "turbo.json"] as const;

export function findMonorepoRoot(startDirs: string[] = [process.cwd()]): string {
  for (const startDir of startDirs.map((dir) => path.resolve(dir))) {
    let current = startDir;

    while (true) {
      if (MONOREPO_MARKERS.some((marker) => existsSync(path.join(current, marker)))) {
        return current;
      }

      const parent = path.dirname(current);
      if (parent === current) {
        break;
      }
      current = parent;
    }
  }

  return path.resolve(startDirs[0] ?? process.cwd());
}

export function getMonorepoRoot(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return findMonorepoRoot([process.cwd(), moduleDir]);
}

export function resolveFromMonorepoRoot(
  relativeOrAbsolutePath: string,
  monorepoRoot = getMonorepoRoot(),
): string {
  if (path.isAbsolute(relativeOrAbsolutePath)) {
    return relativeOrAbsolutePath;
  }

  return path.resolve(monorepoRoot, relativeOrAbsolutePath);
}
