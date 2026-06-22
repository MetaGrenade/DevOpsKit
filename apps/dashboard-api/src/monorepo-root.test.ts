import { describe, expect, it } from "vitest";
import { findMonorepoRoot, resolveFromMonorepoRoot } from "./monorepo-root.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("monorepo root", () => {
  it("finds repo root from dashboard-api cwd", () => {
    const root = findMonorepoRoot([path.join(REPO_ROOT, "apps", "dashboard-api")]);
    expect(root).toBe(REPO_ROOT);
  });

  it("resolves workspace paths from repo root", () => {
    const workspacePath = resolveFromMonorepoRoot(
      "resources/sample-workspaces/basic-server",
      REPO_ROOT,
    );
    expect(workspacePath).toBe(
      path.join(REPO_ROOT, "resources", "sample-workspaces", "basic-server"),
    );
  });
});
