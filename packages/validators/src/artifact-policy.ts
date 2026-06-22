import type { ResolvedArtifactBuild } from "@fdt/core";

/**
 * Recent FXServer artifacts expect manifest `version` metadata on resources.
 * Tune as Cfx.re tightens enforcement.
 */
export const ARTIFACT_MANIFEST_VERSION_REQUIRED = 29_000;

/**
 * Lua 5.4 became the default runtime; the `lua54` manifest directive is deprecated
 * on artifacts at or above this build.
 */
export const ARTIFACT_LUA54_DEPRECATED = 26_000;

export function artifactPolicyApplies(
  artifactBuild: ResolvedArtifactBuild | undefined,
  minimumBuild: number,
): boolean {
  if (!artifactBuild) {
    return false;
  }

  return artifactBuild.build >= minimumBuild;
}

export function artifactMeetsRequirement(
  artifactBuild: ResolvedArtifactBuild | undefined,
  requiredBuild: number,
): boolean | undefined {
  if (!artifactBuild) {
    return undefined;
  }

  return artifactBuild.build >= requiredBuild;
}
