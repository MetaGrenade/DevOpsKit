import { describe, expect, it } from "vitest";
import { deriveMapIdFromResourceName, ensureUniqueMapId, sanitizeMapId } from "./map-store.js";

describe("map id helpers", () => {
  it("sanitizes uppercase and hyphenated resource names", () => {
    expect(deriveMapIdFromResourceName("Eminent-MLO-Pack")).toBe("eminent_mlo_pack");
    expect(deriveMapIdFromResourceName("Meta_Map_Office")).toBe("map_office");
    expect(deriveMapIdFromResourceName("meta_map_scam_office")).toBe("map_scam_office");
  });

  it("prefixes ids that start with numbers", () => {
    expect(sanitizeMapId("3d-mlo")).toBe("map_3d_mlo");
  });

  it("avoids id collisions across different resources", () => {
    const maps = [
      {
        id: "office",
        label: "Office A",
        resourceName: "meta_map_office",
        entrances: [],
        checklist: [],
        status: "draft" as const,
        metadata: {},
      },
    ];

    expect(ensureUniqueMapId("office", maps, "Eminent-Office")).not.toBe("office");
  });
});
