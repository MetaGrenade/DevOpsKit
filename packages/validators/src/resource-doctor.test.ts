import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { WorkspaceSchema } from "@fdt/schemas";
import { scanResources } from "@fdt/scanner";
import { validateResources } from "@fdt/validators";
import { readFile } from "node:fs/promises";

const FIXTURE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../resources/sample-workspaces/basic-server",
);

describe("Resource Doctor fixture", () => {
  it("detects at least five core issue types", async () => {
    const raw = await readFile(path.join(FIXTURE_ROOT, "fdt.workspace.json"), "utf8");
    const workspace = WorkspaceSchema.parse(JSON.parse(raw));

    const scanResult = await scanResources({ workspaceRoot: FIXTURE_ROOT, workspace });
    expect(scanResult.resources.length).toBeGreaterThanOrEqual(4);

    const report = await validateResources({
      workspaceRoot: FIXTURE_ROOT,
      workspace,
      scanResult,
    });

    const codes = new Set(report.findings.map((finding) => finding.code));

    expect(codes.has("manifest.missing")).toBe(true);
    expect(codes.has("manifest.missing_file")).toBe(true);
    expect(codes.has("resource.duplicate_name")).toBe(true);
    expect(codes.has("server_cfg.missing_resource")).toBe(true);
    expect(codes.has("server_cfg.unstarted_resource")).toBe(true);
    expect(report.summary.errors).toBeGreaterThan(0);

    const unstarted = report.findings.filter((finding) => finding.code === "server_cfg.unstarted_resource");
    expect(unstarted.some((finding) => finding.resource === "good_resource")).toBe(true);
    expect(unstarted.some((finding) => finding.resource === "meta_inventory")).toBe(false);
  });
});
