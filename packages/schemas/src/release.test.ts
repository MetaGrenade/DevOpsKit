import { describe, expect, it } from "vitest";
import { CreateReleaseInputSchema, ReleaseSchema, ReleaseStatusSchema } from "./release.js";

describe("ReleaseSchema", () => {
  it("accepts a validated release candidate", () => {
    const release = ReleaseSchema.parse({
      id: "rel_0_1_0",
      version: "0.1.0",
      createdAt: new Date().toISOString(),
      targetEnvironment: "dev",
      status: "validated",
      statusHistory: [
        {
          status: "validated",
          changedAt: new Date().toISOString(),
        },
      ],
      changedResources: ["meta_inventory"],
      validationSummary: {
        errors: 0,
        warnings: 1,
        passed: 4,
      },
      changelogMarkdown: "# Release 0.1.0",
    });

    expect(release.status).toBe("validated");
  });

  it("supports qa workflow statuses", () => {
    for (const status of ["qa-ready", "qa-approved", "deployed"] as const) {
      expect(ReleaseStatusSchema.parse(status)).toBe(status);
    }
  });
});

describe("CreateReleaseInputSchema", () => {
  it("defaults environment to dev", () => {
    const parsed = CreateReleaseInputSchema.parse({ version: "1.0.0" });
    expect(parsed.targetEnvironment).toBe("dev");
    expect(parsed.allowValidationErrors).toBe(false);
  });
});
