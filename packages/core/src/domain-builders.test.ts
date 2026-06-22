import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { upsertZone } from "./zone-store.js";
import { createBusinessFromZone, listBusinesses } from "./business-store.js";
import { createGangFromZone, listGangs } from "./gang-store.js";
import { createJobFromZone, listJobs } from "./job-store.js";
import { createMapPackage, refreshMapChecklist } from "./map-store.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("domain builders", () => {
  it("creates a business from an exported zone", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "fdt-business-"));
    tempDirs.push(root);
    await mkdir(path.join(root, ".fdt", "zones"), { recursive: true });

    await upsertZone(root, {
      id: "shop_front",
      label: "Front Shop",
      type: "sphere",
      purpose: "shop",
      coords: [{ x: 10, y: 20, z: 30 }],
      radius: 2,
      metadata: {},
    });

    const business = await createBusinessFromZone(root, { zoneId: "shop_front" });
    expect(business.type).toBe("shop");
    expect(business.zoneId).toBe("shop_front");
    expect(business.registerEnabled).toBe(true);

    const businesses = await listBusinesses(root);
    expect(businesses).toHaveLength(1);
  });

  it("creates jobs and gangs from exported zones", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "fdt-job-gang-"));
    tempDirs.push(root);
    await mkdir(path.join(root, ".fdt", "zones"), { recursive: true });

    await upsertZone(root, {
      id: "job_duty",
      label: "Mechanic Duty",
      type: "sphere",
      purpose: "job",
      coords: [{ x: 1, y: 2, z: 3 }],
      metadata: {},
    });

    await upsertZone(root, {
      id: "territory_ballas",
      label: "Ballas Territory",
      type: "sphere",
      purpose: "territory",
      coords: [{ x: 4, y: 5, z: 6 }],
      metadata: {},
    });

    const job = await createJobFromZone(root, { zoneId: "job_duty" });
    expect(job.zoneId).toBe("job_duty");
    expect(job.locations[0]?.type).toBe("duty");

    const gang = await createGangFromZone(root, { zoneId: "territory_ballas" });
    expect(gang.territoryIds).toContain("territory_ballas");

    expect(await listJobs(root)).toHaveLength(1);
    expect(await listGangs(root)).toHaveLength(1);
  });

  it("creates and refreshes a map checklist", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "fdt-map-"));
    tempDirs.push(root);
    await mkdir(path.join(root, ".fdt", "content"), { recursive: true });

    const created = await createMapPackage(root, {
      id: "meta_map_test",
      label: "Test Map",
      resourceName: "meta_map_test",
      resourcePath: "server/resources/[maps]/meta_map_test",
      entrances: [{ x: 1, y: 2, z: 3 }],
    });

    expect(created.checklist.length).toBeGreaterThan(0);
    expect(created.status).toBe("draft");

    const refreshed = await refreshMapChecklist(root, created.id);
    expect(refreshed.checklist.some((item) => item.id === "entrances_documented" && item.passed)).toBe(true);
    expect(["audited", "ready"]).toContain(refreshed.status);
  });
});
