import { describe, expect, it } from "vitest";
import { validateVehicles, renderVehicleSpawnTests } from "./vehicle-validator.js";

describe("validateVehicles", () => {
  it("flags duplicate spawn names across resources", () => {
    const report = validateVehicles({
      workspaceName: "Test",
      workspaceRoot: "/tmp/test",
      vehicles: [
        {
          spawnName: "meta_cvpi",
          displayName: "Meta CVPI",
          category: "emergency",
          emergency: true,
          restrictedJobs: [],
          metadata: {},
        },
      ],
      scanned: [
        {
          resourceName: "meta_vehicles_a",
          spawnNames: ["meta_cvpi"],
          files: { yft: ["meta_cvpi.yft"], ytd: [], vehiclesMeta: "data/vehicles.meta", handlingMeta: "data/handling.meta" },
        },
        {
          resourceName: "meta_vehicles_b",
          spawnNames: ["meta_cvpi"],
          files: { yft: [], ytd: [], vehiclesMeta: "data/vehicles.meta" },
        },
      ],
    });

    expect(report.summary.errors).toBe(1);
    expect(report.findings.some((finding) => finding.code === "duplicate_spawn_name")).toBe(true);
  });

  it("renders QA spawn commands", () => {
    const tests = renderVehicleSpawnTests("Test", [
      {
        spawnName: "meta_cvpi",
        displayName: "Meta CVPI",
        category: "emergency",
        emergency: true,
        restrictedJobs: [],
        metadata: { resourceName: "meta_vehicles" },
      },
    ]);

    expect(tests.tests[0]?.command).toBe("/car meta_cvpi");
  });
});
