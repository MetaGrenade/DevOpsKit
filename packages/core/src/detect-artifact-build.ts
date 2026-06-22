import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Workspace } from "@fdt/schemas";

export type ArtifactBuildSource =
  | "workspace.config"
  | "fxserver-artifact-version"
  | "citizen-version-json";

export interface ResolvedArtifactBuild {
  build: number;
  source: ArtifactBuildSource;
  path: string;
}

const ARTIFACT_VERSION_FILENAME = ".fxserver-artifact-version";
const CITIZEN_VERSION_FILENAME = "citizen/version.json";

function parseBuildNumber(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  const direct = Number(trimmed);
  if (Number.isInteger(direct) && direct > 0) {
    return direct;
  }

  const match = trimmed.match(/\b(\d{4,6})\b/);
  if (!match) {
    return undefined;
  }

  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function readBuildFromFile(absolutePath: string): number | undefined {
  if (!existsSync(absolutePath)) {
    return undefined;
  }

  try {
    const raw = readFileSync(absolutePath, "utf8");
    if (absolutePath.endsWith(".json")) {
      const parsed = JSON.parse(raw) as { version?: unknown; build?: unknown };
      if (typeof parsed.build === "number" && parsed.build > 0) {
        return parsed.build;
      }
      if (typeof parsed.version === "number" && parsed.version > 0) {
        return parsed.version;
      }
      if (typeof parsed.version === "string") {
        return parseBuildNumber(parsed.version);
      }
      return undefined;
    }

    return parseBuildNumber(raw);
  } catch {
    return undefined;
  }
}

function toDisplayPath(workspaceRoot: string, absolutePath: string): string {
  return path.relative(workspaceRoot, absolutePath).replace(/\\/g, "/");
}

function candidateArtifactRoots(workspaceRoot: string, workspace: Workspace): string[] {
  const roots = new Set<string>();

  roots.add(path.resolve(workspaceRoot, workspace.serverRoot));

  const serverCfgDir = path.dirname(path.resolve(workspaceRoot, workspace.serverCfg));
  roots.add(serverCfgDir);
  roots.add(path.resolve(serverCfgDir, ".."));
  roots.add(path.resolve(serverCfgDir, "../.."));

  return [...roots];
}

export function detectServerArtifactBuild(
  workspaceRoot: string,
  workspace: Workspace,
): ResolvedArtifactBuild | undefined {
  if (workspace.serverArtifactBuild && workspace.serverArtifactBuild > 0) {
    return {
      build: workspace.serverArtifactBuild,
      source: "workspace.config",
      path: "fdt.workspace.json",
    };
  }

  for (const root of candidateArtifactRoots(workspaceRoot, workspace)) {
    const artifactVersionPath = path.join(root, ARTIFACT_VERSION_FILENAME);
    const build = readBuildFromFile(artifactVersionPath);
    if (build) {
      return {
        build,
        source: "fxserver-artifact-version",
        path: toDisplayPath(workspaceRoot, artifactVersionPath),
      };
    }

    const citizenVersionPath = path.join(root, CITIZEN_VERSION_FILENAME);
    const citizenBuild = readBuildFromFile(citizenVersionPath);
    if (citizenBuild) {
      return {
        build: citizenBuild,
        source: "citizen-version-json",
        path: toDisplayPath(workspaceRoot, citizenVersionPath),
      };
    }
  }

  return undefined;
}
