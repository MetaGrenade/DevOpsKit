import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { importStateBagExport, listStateBagSnapshots } from "./state-bag-store.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("state bag store", () => {
  it("imports exported snapshots into the workspace registry", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "fdt-statebag-"));
    tempDirs.push(root);

    await importStateBagExport(root, {
      schemaVersion: 1,
      exportedAt: "2026-06-21T12:00:00Z",
      exportedBy: "license:test",
      resource: "fdt_devtools",
      snapshot: {
        schemaVersion: 1,
        exportedAt: "2026-06-21T12:00:00Z",
        target: {
          kind: "player",
          bagName: "player:1",
        },
        entries: [{ key: "isLoggedIn", value: true, replicated: true }],
        watchedKeys: ["isLoggedIn"],
      },
    });

    const snapshots = await listStateBagSnapshots(root);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.entries[0]?.key).toBe("isLoggedIn");
  });
});
