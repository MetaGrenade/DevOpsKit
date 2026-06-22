import { describe, expect, it } from "vitest";
import type { ResolvedArtifactBuild } from "@fdt/core";
import {
  ARTIFACT_LUA54_DEPRECATED,
  ARTIFACT_MANIFEST_VERSION_REQUIRED,
  artifactMeetsRequirement,
  artifactPolicyApplies,
} from "./artifact-policy.js";

describe("artifact policy", () => {
  const artifact: ResolvedArtifactBuild = {
    build: 29_753,
    source: "fxserver-artifact-version",
    path: "server/.fxserver-artifact-version",
  };

  it("applies modern checks only when artifact meets minimum build", () => {
    expect(artifactPolicyApplies(artifact, ARTIFACT_MANIFEST_VERSION_REQUIRED)).toBe(true);
    expect(artifactPolicyApplies(artifact, ARTIFACT_LUA54_DEPRECATED)).toBe(true);
    expect(
      artifactPolicyApplies(
        { ...artifact, build: 20_000 },
        ARTIFACT_MANIFEST_VERSION_REQUIRED,
      ),
    ).toBe(false);
    expect(artifactPolicyApplies(undefined, ARTIFACT_MANIFEST_VERSION_REQUIRED)).toBe(false);
  });

  it("evaluates runtime server build requirements", () => {
    expect(artifactMeetsRequirement(artifact, 7290)).toBe(true);
    expect(artifactMeetsRequirement(artifact, 30_000)).toBe(false);
    expect(artifactMeetsRequirement(undefined, 7290)).toBeUndefined();
  });
});
