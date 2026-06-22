import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { WorkspaceSchema } from "@fdt/schemas";
import { scanSecurity } from "@fdt/validators";
import { readFile } from "node:fs/promises";
import { applySecurityBaseline } from "./security-baseline.js";

const FIXTURE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../resources/sample-workspaces/basic-server",
);

describe("security auditor fixture", () => {
  it("flags the intentionally vulnerable demo resource", async () => {
    const raw = await readFile(path.join(FIXTURE_ROOT, "fdt.workspace.json"), "utf8");
    const workspace = WorkspaceSchema.parse(JSON.parse(raw));

    const report = await scanSecurity({
      workspaceRoot: FIXTURE_ROOT,
      workspace,
      resourceFilter: "meta_vulnerable_demo",
    });

    const codes = new Set(report.findings.map((finding) => finding.code));

    expect(codes.has("security.client_triggered_reward")).toBe(true);
    expect(codes.has("security.dangerous_loadstring")).toBe(true);
    expect(report.summary.critical).toBeGreaterThan(0);
  });

  it("suppresses baseline fingerprints while tracking new findings", async () => {
    const findings = [
      {
        fingerprint: "abc123",
        severity: "critical",
        suppressed: false,
        isNew: true,
      },
      {
        fingerprint: "def456",
        severity: "high",
        suppressed: false,
        isNew: true,
      },
    ];

    applySecurityBaseline(findings, ["abc123"]);

    expect(findings[0]?.suppressed).toBe(true);
    expect(findings[0]?.isNew).toBe(false);
    expect(findings[1]?.suppressed).toBe(false);
    expect(findings[1]?.isNew).toBe(true);
  });
});
