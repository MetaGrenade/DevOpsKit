import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanVehicleResource } from "./scan-vehicle-resource.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("scanVehicleResource", () => {
  it("indexes spawn names and stream files from a vehicle resource", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "fdt-vehicle-scan-"));
    tempDirs.push(root);

    const resourceRoot = path.join(root, "server", "resources", "[meta]", "meta_vehicles");
    await mkdir(path.join(resourceRoot, "data"), { recursive: true });
    await mkdir(path.join(resourceRoot, "stream"), { recursive: true });
    await writeFile(
      path.join(resourceRoot, "data", "vehicles.meta"),
      `<?xml version="1.0" encoding="UTF-8"?><CVehicleModelInfo__InitDataList><InitDatas><Item><modelName>meta_cvpi</modelName><gameName>CVPI</gameName><vehicleMakeName>Vapid</vehicleMakeName></Item></InitDatas></CVehicleModelInfo__InitDataList>`,
      "utf8",
    );
    await writeFile(path.join(resourceRoot, "stream", "meta_cvpi.yft"), "", "utf8");

    const result = await scanVehicleResource({
      workspaceRoot: root,
      resourceName: "meta_vehicles",
      resourcesRoot: "server/resources",
    });

    expect(result?.spawnNames).toEqual(["meta_cvpi"]);
    expect(result?.files.yft).toEqual(["meta_cvpi.yft"]);
    expect(result?.vehicles[0]?.displayName).toBe("Vapid CVPI");
  });
});
