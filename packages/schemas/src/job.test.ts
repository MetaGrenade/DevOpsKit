import { describe, expect, it } from "vitest";
import { JobSchema } from "./job.js";

describe("JobSchema", () => {
  it("parses a job with grades and locations", () => {
    const job = JobSchema.parse({
      id: "police",
      label: "Law Enforcement",
      type: "public_safety",
      defaultDuty: true,
      grades: [{ id: "recruit", level: 0, label: "Recruit", payment: 50 }],
      locations: [{ type: "duty", coords: { x: 1, y: 2, z: 3 } }],
    });

    expect(job.grades).toHaveLength(1);
    expect(job.locations[0]?.type).toBe("duty");
  });
});
