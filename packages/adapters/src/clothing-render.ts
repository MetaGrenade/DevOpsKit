import type { ClothingPack, FdtDomainModel } from "@fdt/schemas";
import { luaString } from "./lua-utils.js";

export interface ClothingShopEntry {
  id: string;
  packId: string;
  drawableId: string;
  label: string;
  gender: string;
  category: string;
  resourceName: string;
  componentId?: number;
  drawableSlot?: number;
  textureId?: number;
  textureFile?: string;
  previewImage?: string;
  restrictedJobs: string[];
  restrictedGangs: string[];
  tags: string[];
}

function sortedClothingPacks(model: FdtDomainModel): ClothingPack[] {
  return [...model.clothingPacks].sort((a, b) => a.id.localeCompare(b.id));
}

function entryId(packId: string, drawableId: string, textureId?: number): string {
  return textureId === undefined ? `${packId}:${drawableId}` : `${packId}:${drawableId}:${textureId}`;
}

export function buildClothingShopEntries(model: FdtDomainModel): ClothingShopEntry[] {
  const entries: ClothingShopEntry[] = [];

  for (const pack of sortedClothingPacks(model)) {
    const sortedDrawables = [...pack.drawables].sort((a, b) => a.id.localeCompare(b.id));

    for (const drawable of sortedDrawables) {
      if (drawable.textures.length === 0) {
        entries.push({
          id: entryId(pack.id, drawable.id),
          packId: pack.id,
          drawableId: drawable.id,
          label: drawable.label ?? drawable.id,
          gender: drawable.gender,
          category: drawable.category,
          resourceName: pack.resourceName,
          componentId: drawable.componentId,
          drawableSlot: drawable.drawableId,
          previewImage: drawable.previewImage,
          restrictedJobs: [...drawable.restrictedJobs].sort(),
          restrictedGangs: [...drawable.restrictedGangs].sort(),
          tags: [...new Set([...pack.tags, ...drawable.tags])].sort(),
        });
        continue;
      }

      const sortedTextures = [...drawable.textures].sort((a, b) => a.id.localeCompare(b.id));
      for (const texture of sortedTextures) {
        entries.push({
          id: entryId(pack.id, drawable.id, texture.textureId),
          packId: pack.id,
          drawableId: drawable.id,
          label: texture.label ?? drawable.label ?? drawable.id,
          gender: drawable.gender,
          category: drawable.category,
          resourceName: pack.resourceName,
          componentId: drawable.componentId,
          drawableSlot: drawable.drawableId,
          textureId: texture.textureId,
          textureFile: texture.fileName,
          previewImage: texture.previewImage ?? drawable.previewImage,
          restrictedJobs: [...drawable.restrictedJobs].sort(),
          restrictedGangs: [...drawable.restrictedGangs].sort(),
          tags: [...new Set([...pack.tags, ...drawable.tags])].sort(),
        });
      }
    }
  }

  return entries.sort((a, b) => a.id.localeCompare(b.id));
}

export function renderClothingShopJson(model: FdtDomainModel, generatedAt: string): string {
  return `${JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt,
      entries: buildClothingShopEntries(model),
    },
    null,
    2,
  )}\n`;
}

function renderLuaStringArray(values: string[]): string {
  if (values.length === 0) {
    return "{}";
  }
  return `{ ${values.map((value) => luaString(value)).join(", ")} }`;
}

export function renderQbClothingCatalogLua(model: FdtDomainModel, generatedAt: string): string {
  const entries = buildClothingShopEntries(model);
  const body = entries
    .map((entry) => {
      const lines = [
        `    [${luaString(entry.id)}] = {`,
        `        packId = ${luaString(entry.packId)},`,
        `        drawableId = ${luaString(entry.drawableId)},`,
        `        label = ${luaString(entry.label)},`,
        `        gender = ${luaString(entry.gender)},`,
        `        category = ${luaString(entry.category)},`,
        `        resource = ${luaString(entry.resourceName)},`,
      ];

      if (entry.componentId !== undefined) {
        lines.push(`        componentId = ${entry.componentId},`);
      }
      if (entry.drawableSlot !== undefined) {
        lines.push(`        drawable = ${entry.drawableSlot},`);
      }
      if (entry.textureId !== undefined) {
        lines.push(`        texture = ${entry.textureId},`);
      }
      if (entry.textureFile) {
        lines.push(`        textureFile = ${luaString(entry.textureFile)},`);
      }
      if (entry.previewImage) {
        lines.push(`        previewImage = ${luaString(entry.previewImage)},`);
      }
      if (entry.restrictedJobs.length > 0) {
        lines.push(`        restrictedJobs = ${renderLuaStringArray(entry.restrictedJobs)},`);
      }
      if (entry.restrictedGangs.length > 0) {
        lines.push(`        restrictedGangs = ${renderLuaStringArray(entry.restrictedGangs)},`);
      }
      if (entry.tags.length > 0) {
        lines.push(`        tags = ${renderLuaStringArray(entry.tags)},`);
      }

      lines.push("    },");
      return lines.join("\n");
    })
    .join("\n");

  return [
    "-- Generated by FiveM DevOps Toolkit",
    "-- Adapter: qbcore",
    `-- Generated at: ${generatedAt}`,
    "-- Merge into qb-clothing, illenium-appearance, or a custom shop resource.",
    "FDTClothingCatalog = FDTClothingCatalog or {}",
    "FDTClothingCatalog.Entries = FDTClothingCatalog.Entries or {}",
    "",
    body,
    "",
  ].join("\n");
}

export function renderEsxClothingCatalogJson(model: FdtDomainModel, generatedAt: string): string {
  return `${JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt,
      framework: "esx",
      note: "Import into esx_skin, fivem-appearance, or a custom clothing shop resource.",
      entries: buildClothingShopEntries(model),
    },
    null,
    2,
  )}\n`;
}

export interface OxAppearanceClothingItem {
  id: string;
  label: string;
  gender: string;
  category: string;
  resource: string;
  components: Record<string, { drawable: number; texture: number }>;
  restrictedJobs: string[];
  restrictedGangs: string[];
  tags: string[];
}

function buildOxAppearanceItems(model: FdtDomainModel): OxAppearanceClothingItem[] {
  return buildClothingShopEntries(model)
    .filter((entry) => entry.componentId !== undefined)
    .map((entry) => ({
      id: entry.id,
      label: entry.label,
      gender: entry.gender,
      category: entry.category,
      resource: entry.resourceName,
      components: {
        [String(entry.componentId)]: {
          drawable: entry.drawableSlot ?? 0,
          texture: entry.textureId ?? 0,
        },
      },
      restrictedJobs: entry.restrictedJobs,
      restrictedGangs: entry.restrictedGangs,
      tags: entry.tags,
    }));
}

export function renderOxAppearanceClothingJson(model: FdtDomainModel, generatedAt: string): string {
  return `${JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt,
      framework: "ox-appearance",
      note: "Merge into ox_appearance or illenium-appearance shop configuration.",
      items: buildOxAppearanceItems(model),
    },
    null,
    2,
  )}\n`;
}

export function renderQboxClothingCatalogLua(model: FdtDomainModel, generatedAt: string): string {
  const body = renderQbClothingCatalogLua(model, generatedAt)
    .replace("-- Adapter: qbcore", "-- Adapter: qbox")
    .replace(
      "-- Merge into qb-clothing, illenium-appearance, or a custom shop resource.",
      "-- Qbox servers: merge into qbx_core or illenium-appearance shop configuration.",
    );

  return body.replace(
    "FDTClothingCatalog = FDTClothingCatalog or {}",
    "FDTClothingCatalog = FDTClothingCatalog or {}\n-- qbx_core provides QBShared bridge compatibility for legacy scripts.",
  );
}
