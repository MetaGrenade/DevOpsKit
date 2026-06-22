import { describe, expect, it } from "vitest";
import { SecurityAuditReportSchema, SecurityBaselineSchema } from "./security.js";

describe("SecurityAuditReportSchema", () => {
  it("accepts audit reports with severity summary", () => {
    const report = SecurityAuditReportSchema.parse({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      workspaceName: "Test",
      workspaceRoot: "/tmp/test",
      summary: {
        resourcesScanned: 1,
        luaFilesScanned: 2,
        critical: 1,
        high: 0,
        medium: 1,
        low: 0,
        info: 0,
        suppressed: 0,
        newFindings: 2,
        newCritical: 1,
        newHigh: 0,
      },
      findings: [
        {
          id: "sec_abc",
          fingerprint: "abc",
          severity: "critical",
          confidence: "high",
          category: "economy",
          code: "security.client_triggered_reward",
          message: "Reward handler without validation",
        },
      ],
    });

    expect(report.summary.newCritical).toBe(1);
  });
});

describe("SecurityBaselineSchema", () => {
  it("stores finding fingerprints", () => {
    const baseline = SecurityBaselineSchema.parse({
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      findingFingerprints: ["abc", "def"],
    });

    expect(baseline.findingFingerprints).toHaveLength(2);
  });
});
