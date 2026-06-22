import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateContent } from "./content-doctor.js";
import { FDT_CRAFTING_FILE, FDT_ITEMS_FILE, FDT_SHOPS_FILE } from "@fdt/core";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function writeJson(relativePath: string, payload: unknown, root: string) {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function makeWorkspace(options?: {
  items?: unknown[];
  shops?: unknown[];
  recipes?: unknown[];
}): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "fdt-content-val-"));
  tempDirs.push(dir);

  await writeJson(
    FDT_ITEMS_FILE,
    { schemaVersion: 1, updatedAt: new Date().toISOString(), items: options?.items ?? [] },
    dir,
  );
  await writeJson(
    FDT_SHOPS_FILE,
    { schemaVersion: 1, updatedAt: new Date().toISOString(), shops: options?.shops ?? [] },
    dir,
  );
  await writeJson(
    FDT_CRAFTING_FILE,
    { schemaVersion: 1, updatedAt: new Date().toISOString(), recipes: options?.recipes ?? [] },
    dir,
  );

  return dir;
}

describe("validateContent", () => {
  it("flags duplicate item ids as errors", async () => {
    const workspaceRoot = await makeWorkspace({
      items: [
        {
          id: "duplicate_item",
          label: "One",
          category: "misc",
          weight: 0,
          stackable: true,
          unique: false,
          usable: false,
          metadata: {},
        },
        {
          id: "duplicate_item",
          label: "Two",
          category: "misc",
          weight: 0,
          stackable: true,
          unique: false,
          usable: false,
          metadata: {},
        },
      ],
    });

    const report = await validateContent({
      workspaceRoot,
      workspaceName: "Test",
    });

    expect(report.summary.errors).toBe(1);
    expect(report.findings.some((f) => f.code === "content.duplicate_item_id")).toBe(true);
  });

  it("flags shop and crafting references to missing items", async () => {
    const workspaceRoot = await makeWorkspace({
      items: [
        {
          id: "steel",
          label: "Steel",
          category: "material",
          weight: 100,
          stackable: true,
          unique: false,
          usable: false,
          metadata: {},
        },
      ],
      shops: [
        {
          id: "hardware_store",
          label: "Hardware Store",
          type: "general",
          currency: "cash",
          items: [{ itemId: "missing_bolt", price: 10, metadata: {} }],
          locations: [],
          metadata: {},
        },
      ],
      recipes: [
        {
          id: "make_nails",
          label: "Make Nails",
          inputs: [{ itemId: "steel", amount: 1 }],
          outputs: [{ itemId: "missing_nails", amount: 2 }],
          metadata: {},
        },
      ],
    });

    const report = await validateContent({
      workspaceRoot,
      workspaceName: "Test",
    });

    expect(report.summary.shopsChecked).toBe(1);
    expect(report.summary.recipesChecked).toBe(1);
    expect(report.findings.some((f) => f.code === "content.shop_missing_item")).toBe(true);
    expect(report.findings.some((f) => f.code === "content.recipe_missing_output_item")).toBe(true);
  });
});
