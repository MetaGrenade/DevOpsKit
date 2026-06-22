import { describe, expect, it } from "vitest";
import { validateClothingConflicts } from "./clothing-validator.js";

describe("clothing-validator", () => {
  it("flags duplicate drawable slots and missing previews", () => {
    const report = validateClothingConflicts({
      workspaceName: "Test",
      workspaceRoot: "/tmp/test",
      packs: [
        {
          id: "pack_a",
          label: "Pack A",
          resourceName: "meta_clothing_a",
          genderScope: "male",
          drawables: [
            {
              id: "drawable_a",
              category: "tops",
              gender: "male",
              componentId: 11,
              drawableId: 1,
              fileName: "shirt.ytd",
              relativePath: "stream/shirt.ytd",
              textures: [],
              restrictedJobs: [],
              restrictedGangs: [],
              tags: [],
            },
          ],
          tags: [],
          status: "scanned",
          metadata: {},
        },
        {
          id: "pack_b",
          label: "Pack B",
          resourceName: "meta_clothing_b",
          genderScope: "male",
          drawables: [
            {
              id: "drawable_b",
              category: "tops",
              gender: "male",
              componentId: 11,
              drawableId: 1,
              fileName: "shirt.ytd",
              relativePath: "stream/shirt.ytd",
              textures: [],
              restrictedJobs: [],
              restrictedGangs: [],
              tags: [],
            },
          ],
          tags: [],
          status: "scanned",
          metadata: {},
        },
      ],
    });

    expect(report.summary.errors).toBeGreaterThan(0);
    expect(report.findings.some((finding) => finding.code === "duplicate_slot")).toBe(true);
    expect(report.findings.some((finding) => finding.code === "missing_preview")).toBe(true);
  });
});
