import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  StateBagExportSchema,
  StateBagSnapshotRegistrySchema,
  StateBagSnapshotSchema,
  type StateBagExport,
  type StateBagSnapshot,
  type StateBagSnapshotRegistry,
} from "@fdt/schemas";
import { FDT_STATE_BAG_SNAPSHOTS_FILE } from "./workspace.js";

function emptyRegistry(): StateBagSnapshotRegistry {
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    snapshots: [],
  };
}

export function resolveStateBagSnapshotsPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, FDT_STATE_BAG_SNAPSHOTS_FILE);
}

export async function loadStateBagRegistry(workspaceRoot: string): Promise<StateBagSnapshotRegistry> {
  const snapshotsPath = resolveStateBagSnapshotsPath(workspaceRoot);
  if (!existsSync(snapshotsPath)) {
    return emptyRegistry();
  }

  const raw = await readFile(snapshotsPath, "utf8");
  return StateBagSnapshotRegistrySchema.parse(JSON.parse(raw));
}

export async function saveStateBagRegistry(
  workspaceRoot: string,
  registry: StateBagSnapshotRegistry,
): Promise<string> {
  const snapshotsPath = resolveStateBagSnapshotsPath(workspaceRoot);
  await mkdir(path.dirname(snapshotsPath), { recursive: true });

  const payload: StateBagSnapshotRegistry = {
    ...registry,
    updatedAt: new Date().toISOString(),
  };

  await writeFile(snapshotsPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return snapshotsPath;
}

export async function listStateBagSnapshots(workspaceRoot: string): Promise<StateBagSnapshot[]> {
  const registry = await loadStateBagRegistry(workspaceRoot);
  return registry.snapshots;
}

function snapshotId(snapshot: StateBagSnapshot): string {
  if (snapshot.id) {
    return snapshot.id;
  }
  return `${snapshot.target.bagName}:${snapshot.exportedAt}`;
}

export async function importStateBagExport(
  workspaceRoot: string,
  payload: StateBagExport,
): Promise<{ imported: number; snapshots: StateBagSnapshot[] }> {
  const parsed = StateBagExportSchema.parse(payload);
  const snapshot = StateBagSnapshotSchema.parse({
    ...parsed.snapshot,
    exportedAt: parsed.exportedAt,
    exportedBy: parsed.exportedBy,
    resource: parsed.resource,
    id: parsed.snapshot.id ?? `${parsed.snapshot.target.bagName}-${Date.now()}`,
  });

  const registry = await loadStateBagRegistry(workspaceRoot);
  const id = snapshotId(snapshot);
  const index = registry.snapshots.findIndex((entry) => snapshotId(entry) === id);

  if (index >= 0) {
    registry.snapshots[index] = snapshot;
  } else {
    registry.snapshots.push(snapshot);
  }

  registry.snapshots.sort((a, b) => b.exportedAt.localeCompare(a.exportedAt));
  await saveStateBagRegistry(workspaceRoot, registry);

  return { imported: 1, snapshots: registry.snapshots };
}
