import { describe, expect, it } from "vitest";
import { validateMaps, renderMapTestPoints } from "./map-validator.js";

describe("validateMaps", () => {
  it("flags missing manifest and empty stream folders", () => {
    const report = validateMaps({
      workspaceName: "Test",
      workspaceRoot: "/tmp/test",
      maps: [
        {
          id: "map_office",
          label: "Office",
          resourceName: "meta_map_office",
          entrances: [],
          checklist: [],
          status: "draft",
          metadata: {},
        },
      ],
      scanned: [
        {
          resourceName: "meta_map_office",
          resourcePath: "server/resources/[meta]/meta_map_office",
          hasManifest: false,
          streamCounts: { ymap: 0, ytyp: 0, ybn: 0, ydr: 0, ytd: 0, other: 0 },
          streamFileCount: 0,
          hasEntrancesFile: false,
          hasTestPointsFile: false,
          entrances: [],
          testPoints: [],
        },
      ],
    });

    expect(report.summary.errors).toBe(1);
    expect(report.findings.some((finding) => finding.code === "missing_manifest")).toBe(true);
    expect(report.findings.some((finding) => finding.code === "empty_stream_folder")).toBe(true);
  });

  it("renders QA test points from entrances", () => {
    const exportPayload = renderMapTestPoints({
      id: "map_office",
      label: "Office",
      resourceName: "meta_map_office",
      entrances: [{ x: 1, y: 2, z: 3 }],
      checklist: [],
      status: "draft",
      metadata: {},
    });

    expect(exportPayload.testPoints).toHaveLength(1);
    expect(exportPayload.testPoints[0]?.type).toBe("entrance");
  });
});
