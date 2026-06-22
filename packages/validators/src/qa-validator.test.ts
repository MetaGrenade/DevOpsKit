import { describe, expect, it } from "vitest";
import { validateQaScenarios } from "./qa-validator.js";

const baseRegistry = {
  schemaVersion: 1 as const,
  updatedAt: new Date().toISOString(),
  scenarios: [
    {
      id: "valid-scenario",
      label: "Valid Scenario",
      category: "core",
      preconditions: [],
      steps: [
        { id: "step_a", type: "manual" as const, label: "Do thing", metadata: {} },
      ],
      expectedResults: ["Works"],
    },
  ],
};

describe("validateQaScenarios", () => {
  it("returns no errors for a valid registry", async () => {
    const report = await validateQaScenarios({
      workspaceRoot: "/tmp/workspace",
      workspaceName: "Test",
      registry: baseRegistry,
    });

    expect(report.summary.errors).toBe(0);
    expect(report.summary.scenariosChecked).toBe(1);
  });

  it("flags duplicate scenario ids and teleport steps without coords", async () => {
    const report = await validateQaScenarios({
      workspaceRoot: "/tmp/workspace",
      workspaceName: "Test",
      registry: {
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
        scenarios: [
          ...baseRegistry.scenarios,
          {
            id: "valid-scenario",
            label: "Duplicate",
            category: "core",
            preconditions: [],
            steps: [{ id: "tp", type: "teleport" as const, label: "Go", metadata: {} }],
            expectedResults: [],
          },
        ],
      },
    });

    expect(report.summary.errors).toBeGreaterThanOrEqual(1);
    expect(report.findings.some((finding) => finding.code === "qa.duplicate_scenario_id")).toBe(true);
    expect(report.findings.some((finding) => finding.code === "qa.teleport_missing_coords")).toBe(true);
    expect(report.findings.some((finding) => finding.code === "qa.missing_expected_results")).toBe(true);
  });
});
