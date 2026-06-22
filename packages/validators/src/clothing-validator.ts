import {
  type ClothingConflictFinding,
  type ClothingPack,
  type ClothingValidationReport,
} from "@fdt/schemas";

function slotKey(drawable: ClothingPack["drawables"][number], textureId?: number): string {
  return [
    drawable.gender,
    drawable.category,
    drawable.componentId ?? "na",
    drawable.drawableId ?? drawable.id,
    textureId ?? "base",
  ].join(":");
}

export interface ValidateClothingOptions {
  workspaceName: string;
  workspaceRoot: string;
  packs: ClothingPack[];
}

export function validateClothingConflicts(options: ValidateClothingOptions): ClothingValidationReport {
  const findings: ClothingConflictFinding[] = [];
  const slotOwners = new Map<string, { packId: string; drawableId: string }>();
  let drawablesChecked = 0;

  for (const pack of options.packs) {
    for (const drawable of pack.drawables) {
      drawablesChecked += 1;

      if (!drawable.label) {
        findings.push({
          id: `missing-label:${pack.id}:${drawable.id}`,
          severity: "info",
          code: "missing_label",
          message: `Drawable ${drawable.id} is missing a friendly label`,
          packId: pack.id,
          drawableId: drawable.id,
        });
      }

      if (!drawable.previewImage && drawable.textures.every((texture) => !texture.previewImage)) {
        findings.push({
          id: `missing-preview:${pack.id}:${drawable.id}`,
          severity: "warning",
          code: "missing_preview",
          message: `Drawable ${drawable.label ?? drawable.id} has no preview image reference`,
          packId: pack.id,
          drawableId: drawable.id,
        });
      }

      if (drawable.fileName.endsWith(".ydd") && drawable.textures.length === 0) {
        findings.push({
          id: `missing-texture:${pack.id}:${drawable.id}`,
          severity: "warning",
          code: "missing_texture",
          message: `Drawable ${drawable.label ?? drawable.id} has no indexed texture variants`,
          packId: pack.id,
          drawableId: drawable.id,
          details: { fileName: drawable.fileName },
        });
      }

      const keys = [
        slotKey(drawable),
        ...drawable.textures.map((texture) => slotKey(drawable, texture.textureId)),
      ];

      for (const key of keys) {
        const existing = slotOwners.get(key);
        if (existing && (existing.packId !== pack.id || existing.drawableId !== drawable.id)) {
          findings.push({
            id: `duplicate-slot:${key}:${pack.id}:${drawable.id}`,
            severity: "error",
            code: "duplicate_slot",
            message: `Drawable slot conflict for ${key} (also used by ${existing.packId}/${existing.drawableId})`,
            packId: pack.id,
            drawableId: drawable.id,
            details: { slot: key, otherPackId: existing.packId, otherDrawableId: existing.drawableId },
          });
        } else {
          slotOwners.set(key, { packId: pack.id, drawableId: drawable.id });
        }
      }

      const duplicateTextureNames = drawable.textures
        .map((texture) => texture.fileName.toLowerCase())
        .filter((fileName, index, all) => all.indexOf(fileName) !== index);
      if (duplicateTextureNames.length > 0) {
        findings.push({
          id: `duplicate-texture-name:${pack.id}:${drawable.id}`,
          severity: "error",
          code: "duplicate_texture_name",
          message: `Drawable ${drawable.id} has duplicate texture file names`,
          packId: pack.id,
          drawableId: drawable.id,
          details: { fileNames: [...new Set(duplicateTextureNames)] },
        });
      }
    }
  }

  const fileNameOwners = new Map<string, { packId: string; drawableId: string }>();
  for (const pack of options.packs) {
    for (const drawable of pack.drawables) {
      const fileKey = drawable.fileName.toLowerCase();
      const existing = fileNameOwners.get(fileKey);
      if (existing && existing.packId !== pack.id) {
        findings.push({
          id: `duplicate-file:${fileKey}`,
          severity: "warning",
          code: "duplicate_file_name",
          message: `File name ${drawable.fileName} appears in multiple packs`,
          packId: pack.id,
          drawableId: drawable.id,
          details: { otherPackId: existing.packId },
        });
      } else {
        fileNameOwners.set(fileKey, { packId: pack.id, drawableId: drawable.id });
      }
    }
  }

  const summary = {
    packsChecked: options.packs.length,
    drawablesChecked,
    errors: findings.filter((finding) => finding.severity === "error").length,
    warnings: findings.filter((finding) => finding.severity === "warning").length,
    info: findings.filter((finding) => finding.severity === "info").length,
  };

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    workspaceName: options.workspaceName,
    workspaceRoot: options.workspaceRoot,
    summary,
    findings: findings.sort((a, b) => {
      const rank = { error: 0, warning: 1, info: 2 } as const;
      return rank[a.severity] - rank[b.severity];
    }),
  };
}

export function renderClothingChangelog(
  packs: ClothingPack[],
  options?: { since?: string; title?: string },
): string {
  const sinceMs = options?.since ? Date.parse(options.since) : 0;
  const lines = [
    `# ${options?.title ?? "Clothing Pack Changelog"}`,
    "",
    `- Generated: ${new Date().toISOString()}`,
    options?.since ? `- Since: ${options.since}` : "- Since: beginning",
    "",
  ];

  for (const pack of packs) {
    const lastScannedAt =
      typeof pack.metadata.lastScannedAt === "string" ? pack.metadata.lastScannedAt : null;
    if (sinceMs > 0 && lastScannedAt && Date.parse(lastScannedAt) < sinceMs) {
      continue;
    }

    lines.push(`## ${pack.label} (${pack.id})`);
    lines.push(`- Resource: ${pack.resourceName}`);
    lines.push(`- Status: ${pack.status}`);
    lines.push(`- Drawables: ${pack.drawables.length}`);
    if (pack.tags.length > 0) {
      lines.push(`- Tags: ${pack.tags.join(", ")}`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}
