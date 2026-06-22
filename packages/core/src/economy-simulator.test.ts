import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { saveContentRegistry } from "./content-store.js";
import { deriveEconomyActivities, runEconomySimulation, simulateEconomy } from "./economy-simulator.js";
import { saveJobRegistry } from "./job-store.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("economy simulator", () => {
  it("compares at least three income activities from domain data", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "fdt-economy-"));
    tempDirs.push(root);

    await saveJobRegistry(root, {
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      jobs: [
        {
          id: "police",
          label: "Police",
          type: "public_safety",
          defaultDuty: false,
          grades: [
            { id: "cadet", level: 0, label: "Cadet", payment: 900, permissions: [] },
            { id: "officer", level: 1, label: "Officer", payment: 1400, permissions: [] },
          ],
          locations: [],
          metadata: {},
        },
        {
          id: "weed",
          label: "Weed Run",
          type: "criminal",
          defaultDuty: false,
          grades: [{ id: "runner", level: 0, label: "Runner", payment: 2200, permissions: [] }],
          locations: [],
          metadata: {},
        },
      ],
    });

    await saveContentRegistry(root, {
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      items: [
        {
          id: "coffee",
          label: "Coffee",
          category: "drink",
          weight: 100,
          stackable: true,
          unique: false,
          usable: true,
          economy: { basePrice: 25 },
          metadata: {},
        },
      ],
    });

    const report = await runEconomySimulation({
      workspaceRoot: root,
      workspaceName: "Economy Test",
      hours: 5,
    });

    expect(report.activities.length).toBeGreaterThanOrEqual(3);
    expect(report.summary.topEarnerNetPerHour).toBeGreaterThan(0);
    expect(report.summary.medianNetPerHour).toBeGreaterThan(0);
    expect(["low", "moderate", "high"]).toContain(report.summary.inflationRisk);
  });

  it("derives fallback activities when workspace data is sparse", () => {
    const profile = {
      schemaVersion: 1 as const,
      label: "default",
      paychecksPerHour: 2,
      sessionHours: 4,
      sinks: {
        medicalPerSession: 500,
        repairPerSession: 750,
        finesPerSession: 250,
        taxRate: 0.08,
      },
      activities: [],
    };

    const activities = deriveEconomyActivities(
      {
        items: [],
        vehicles: [],
        businesses: [],
        maps: [],
        jobs: [],
        gangs: [],
        clothingPacks: [],
      },
      profile,
    );

    expect(activities.length).toBeGreaterThanOrEqual(3);

    const report = simulateEconomy({
      workspaceName: "Sparse",
      profile,
      model: {
        items: [],
        vehicles: [],
        businesses: [],
        maps: [],
        jobs: [],
        gangs: [],
        clothingPacks: [],
      },
      hours: 4,
    });

    expect(report.summary.comparedActivities).toBeGreaterThanOrEqual(3);
  });
});
