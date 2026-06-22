import type { VehicleHandlingComparison, VehicleHandlingMetrics } from "@fdt/schemas";

function readMetaValue(content: string, tag: string): number | undefined {
  const pattern = new RegExp(`<${tag}\\s+value="([^"]+)"`, "i");
  const match = content.match(pattern);
  if (!match?.[1]) {
    return undefined;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseHandlingMeta(content: string, spawnName: string, resourceName?: string): VehicleHandlingMetrics {
  return {
    spawnName,
    resourceName,
    mass: readMetaValue(content, "fMass"),
    driveMaxFlatVel: readMetaValue(content, "fInitialDriveMaxFlatVel"),
    brakeForce: readMetaValue(content, "fBrakeForce"),
    tractionMax: readMetaValue(content, "fTractionCurveMax"),
  };
}

export function compareHandlingMetrics(
  baseline: VehicleHandlingMetrics,
  target: VehicleHandlingMetrics,
): { deltas: VehicleHandlingComparison["deltas"]; notes: string[] } {
  const deltas: VehicleHandlingComparison["deltas"] = {};
  const notes: string[] = [];

  for (const key of ["mass", "driveMaxFlatVel", "brakeForce", "tractionMax"] as const) {
    const base = baseline[key];
    const next = target[key];
    if (base === undefined || next === undefined) {
      continue;
    }
    deltas[key] = Number((next - base).toFixed(4));
  }

  if (deltas.driveMaxFlatVel !== undefined) {
    if (deltas.driveMaxFlatVel > 5) {
      notes.push("Target has materially higher flat velocity than baseline.");
    } else if (deltas.driveMaxFlatVel < -5) {
      notes.push("Target is slower than baseline on flat velocity.");
    }
  }

  if (deltas.brakeForce !== undefined) {
    if (deltas.brakeForce > 0.5) {
      notes.push("Target brakes harder than baseline.");
    } else if (deltas.brakeForce < -0.5) {
      notes.push("Target brakes softer than baseline.");
    }
  }

  return { deltas, notes };
}

export function extractHandlingBlock(content: string, spawnName: string): string | null {
  const pattern = new RegExp(
    `<Item[\\s\\S]*?<handlingName>\\s*${spawnName}\\s*</handlingName>[\\s\\S]*?</Item>`,
    "i",
  );
  const match = content.match(pattern);
  return match?.[0] ?? null;
}

export function parseVehicleModelNames(content: string): string[] {
  const names = new Set<string>();
  const pattern = /<modelName>\s*([^<\s]+)\s*<\/modelName>/gi;
  for (const match of content.matchAll(pattern)) {
    const name = match[1]?.trim().toLowerCase();
    if (name) {
      names.add(name);
    }
  }
  return [...names].sort();
}

export function parseVehicleDisplayName(content: string, spawnName: string): string | undefined {
  const blockPattern = new RegExp(
    `<Item>[\\s\\S]*?<modelName>\\s*${spawnName}\\s*</modelName>[\\s\\S]*?</Item>`,
    "i",
  );
  const block = content.match(blockPattern)?.[0];
  if (!block) {
    return undefined;
  }

  const gameName = block.match(/<gameName>\s*([^<]+)\s*<\/gameName>/i)?.[1]?.trim();
  const vehicleMake = block.match(/<vehicleMakeName>\s*([^<]+)\s*<\/vehicleMakeName>/i)?.[1]?.trim();
  if (gameName && vehicleMake) {
    return `${vehicleMake} ${gameName}`;
  }
  return gameName;
}
