import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  deleteItem,
  listItems,
  loadContentRegistry,
  resolveItemsPath,
  upsertItem,
} from "./content-store.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "fdt-content-"));
  tempDirs.push(dir);
  return dir;
}

describe("content-store", () => {
  it("creates and updates items on disk", async () => {
    const workspaceRoot = await makeWorkspace();

    await upsertItem(workspaceRoot, {
      id: "bandage",
      label: "Bandage",
      category: "medical",
      weight: 0.1,
      stackable: true,
      unique: false,
      usable: true,
      metadata: {},
    });

    const items = await listItems(workspaceRoot);
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe("bandage");

    await upsertItem(workspaceRoot, {
      id: "bandage",
      label: "Medical Bandage",
      category: "medical",
      weight: 0.1,
      stackable: true,
      unique: false,
      usable: true,
      metadata: {},
    });

    const updated = await listItems(workspaceRoot);
    expect(updated[0]?.label).toBe("Medical Bandage");

    const raw = await readFile(resolveItemsPath(workspaceRoot), "utf8");
    const registry = loadContentRegistry(workspaceRoot);
    await expect(registry).resolves.toMatchObject({
      schemaVersion: 1,
      items: [{ id: "bandage", label: "Medical Bandage" }],
    });
    expect(raw).toContain("Medical Bandage");

    expect(await deleteItem(workspaceRoot, "bandage")).toBe(true);
    expect(await listItems(workspaceRoot)).toHaveLength(0);
  });
});
