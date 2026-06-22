import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createClothingPack, listClothingPacks, upsertClothingPack } from "./clothing-store.js";
import { inferClothingCategory, inferClothingGender, scanClothingPack } from "./scan-clothing-pack.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("scan-clothing-pack", () => {
  it("infers gender and category from file names", () => {
    expect(inferClothingGender("mp_m_freemode_01^meta_jacket_001.ydd")).toBe("male");
    expect(inferClothingGender("mp_f_freemode_01^skirt_001.ydd")).toBe("female");
    expect(inferClothingCategory("mp_m_freemode_01^meta_jacket_001.ydd").category).toBe("tops");
    expect(inferClothingCategory("stream/pants_001.ydd").category).toBe("legs");
  });

  it("indexes drawables and textures from a resource stream folder", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "fdt-clothing-scan-"));
    tempDirs.push(root);

    const resourcePath = path.join(root, "server", "resources", "[meta]", "meta_clothing_a");
    const streamPath = path.join(resourcePath, "stream");
    await mkdir(streamPath, { recursive: true });
    await writeFile(path.join(streamPath, "mp_m_freemode_01^meta_jacket_001.ydd"), "ydd", "utf8");
    await writeFile(path.join(streamPath, "mp_m_freemode_01^meta_jacket_001.ytd"), "ytd", "utf8");

    const pack = await createClothingPack(root, {
      id: "pack_a",
      label: "Pack A",
      resourceName: "meta_clothing_a",
      resourcePath: "server/resources/[meta]/meta_clothing_a",
    });

    const result = await scanClothingPack({ workspaceRoot: root, pack });
    expect(result.scannedFiles).toBe(2);
    expect(result.pack.drawables).toHaveLength(1);
    expect(result.pack.drawables[0]?.textures).toHaveLength(1);
    expect(result.pack.drawables[0]?.category).toBe("tops");

    await upsertClothingPack(root, result.pack);
    expect(await listClothingPacks(root)).toHaveLength(1);
  });
});
