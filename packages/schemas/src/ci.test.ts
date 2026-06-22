import { describe, expect, it } from "vitest";
import { CiPipelineReportSchema } from "./ci.js";

describe("CiPipelineReportSchema", () => {
  it("parses a minimal pipeline report", () => {
    const report = CiPipelineReportSchema.parse({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      workspaceName: "Test",
      workspaceRoot: "/tmp/test",
      passed: true,
      gates: [
        {
          id: "validate",
          status: "passed",
          blocking: true,
          summary: { errors: 0, warnings: 0 },
        },
      ],
    });

    expect(report.passed).toBe(true);
    expect(report.gates).toHaveLength(1);
  });
});
