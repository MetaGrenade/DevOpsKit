import { describe, expect, it } from "vitest";
import { ZoneExportSchema, ZoneSchema } from "./zone.js";

describe("ZoneSchema", () => {
  it("accepts sphere and box zones", () => {
    const sphere = ZoneSchema.parse({
      id: "stash_a",
      label: "Stash A",
      type: "sphere",
      purpose: "stash",
      coords: [{ x: 0, y: 0, z: 72 }],
      radius: 1.5,
      metadata: {},
    });

    expect(sphere.type).toBe("sphere");

    const box = ZoneSchema.parse({
      id: "job_zone",
      label: "Job Zone",
      type: "box",
      purpose: "job",
      coords: [{ x: 100, y: 200, z: 30 }],
      width: 4,
      length: 6,
      heading: 45,
      metadata: {},
    });

    expect(box.type).toBe("box");
  });

  it("rejects invalid zone ids", () => {
    const result = ZoneSchema.safeParse({
      id: "Bad Zone!",
      label: "Invalid",
      type: "sphere",
      purpose: "custom",
      coords: [{ x: 0, y: 0, z: 0 }],
      radius: 2,
      metadata: {},
    });

    expect(result.success).toBe(false);
  });
});

describe("ZoneExportSchema", () => {
  it("requires at least one zone", () => {
    const result = ZoneExportSchema.safeParse({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      resource: "fdt_devtools",
      zones: [],
    });

    expect(result.success).toBe(false);
  });
});
