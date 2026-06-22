import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import {
  ClothingCategorySchema,
  ClothingDrawableSchema,
  ClothingGenderSchema,
  ClothingTextureVariantSchema,
  type ClothingCategory,
  type ClothingDrawable,
  type ClothingGender,
  type ClothingPack,
} from "@fdt/schemas";

const CATEGORY_KEYWORDS: Array<{ pattern: RegExp; category: ClothingCategory; componentId?: number }> = [
  { pattern: /face|head/i, category: "face", componentId: 0 },
  { pattern: /mask/i, category: "mask", componentId: 1 },
  { pattern: /hair/i, category: "hair", componentId: 2 },
  { pattern: /torso|arms|body/i, category: "torso", componentId: 3 },
  { pattern: /pants|legs|trouser/i, category: "legs", componentId: 4 },
  { pattern: /bag|backpack/i, category: "bags", componentId: 5 },
  { pattern: /shoe|feet|boot/i, category: "shoes", componentId: 6 },
  { pattern: /accessory|chain|watch/i, category: "accessory", componentId: 7 },
  { pattern: /undershirt|tshirt/i, category: "undershirt", componentId: 8 },
  { pattern: /armor|vest/i, category: "armor", componentId: 9 },
  { pattern: /decal|badge/i, category: "decals", componentId: 10 },
  { pattern: /jacket|shirt|top|coat|skirt/i, category: "tops", componentId: 11 },
];

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export function inferClothingGender(input: string): ClothingGender {
  const lower = input.toLowerCase();
  if (/mp_m_|_m_|male|freemode_m/.test(lower)) {
    return "male";
  }
  if (/mp_f_|_f_|female|freemode_f/.test(lower)) {
    return "female";
  }
  return "shared";
}

export function inferClothingCategory(input: string): {
  category: ClothingCategory;
  componentId?: number;
} {
  for (const entry of CATEGORY_KEYWORDS) {
    if (entry.pattern.test(input)) {
      return { category: ClothingCategorySchema.parse(entry.category), componentId: entry.componentId };
    }
  }

  const componentMatch = input.match(/component[_-]?(\d{1,2})/i);
  if (componentMatch) {
    const componentId = Number(componentMatch[1]);
    const categories: ClothingCategory[] = [
      "face",
      "mask",
      "hair",
      "torso",
      "legs",
      "bags",
      "shoes",
      "accessory",
      "undershirt",
      "armor",
      "decals",
      "tops",
    ];
    return {
      category: categories[componentId] ?? "custom",
      componentId,
    };
  }

  return { category: "custom" };
}

function drawableBaseName(fileName: string): string {
  return fileName.replace(/\.(ydd|ytd|ydr)$/i, "").replace(/_diff_\d+$/i, "");
}

function extractNumericId(input: string): number | undefined {
  const match = input.match(/(?:^|[_^])(\d{1,4})(?:\.|$)/);
  return match ? Number(match[1]) : undefined;
}

function buildDrawableId(resourceName: string, baseName: string): string {
  const payload = `${resourceName}:${baseName.toLowerCase()}`;
  return `drw_${createHash("sha256").update(payload).digest("hex").slice(0, 10)}`;
}

function buildTextureId(baseName: string, fileName: string): string {
  return slugify(`${baseName}_${path.basename(fileName, path.extname(fileName))}`) || "texture";
}

export interface ScanClothingPackOptions {
  workspaceRoot: string;
  pack: ClothingPack;
}

export interface ScanClothingPackResult {
  pack: ClothingPack;
  scannedFiles: number;
}

export async function scanClothingPack(options: ScanClothingPackOptions): Promise<ScanClothingPackResult> {
  const resourcePath = options.pack.resourcePath ?? options.pack.resourceName;
  const absoluteResourcePath = path.resolve(options.workspaceRoot, resourcePath);
  const streamDir = path.join(absoluteResourcePath, "stream");

  if (!existsSync(streamDir)) {
    return {
      pack: {
        ...options.pack,
        drawables: [],
        status: "draft",
      },
      scannedFiles: 0,
    };
  }

  const files = await fg(["**/*.{ydd,ytd,ydr}"], {
    cwd: streamDir,
    onlyFiles: true,
    absolute: false,
    dot: false,
  });

  const yddFiles = files.filter((file) => file.toLowerCase().endsWith(".ydd"));
  const ytdFiles = files.filter((file) => file.toLowerCase().endsWith(".ytd"));
  const ydrFiles = files.filter((file) => file.toLowerCase().endsWith(".ydr"));

  const texturesByBase = new Map<string, typeof ytdFiles>();
  for (const file of ytdFiles) {
    const base = drawableBaseName(path.basename(file));
    const bucket = texturesByBase.get(base) ?? [];
    bucket.push(file);
    texturesByBase.set(base, bucket);
  }

  const drawables: ClothingDrawable[] = [];

  for (const relativeFile of [...yddFiles, ...ydrFiles].sort((a, b) => a.localeCompare(b))) {
    const fileName = path.basename(relativeFile);
    const baseName = drawableBaseName(fileName);
    const inferenceSource = `${relativeFile} ${baseName}`;
    const gender = inferClothingGender(inferenceSource);
    const { category, componentId } = inferClothingCategory(inferenceSource);
    const textureFiles = texturesByBase.get(baseName) ?? [];

    const textures = textureFiles.map((textureFile) => {
      const textureFileName = path.basename(textureFile);
      return ClothingTextureVariantSchema.parse({
        id: buildTextureId(baseName, textureFileName),
        textureId: extractNumericId(textureFileName),
        label: textureFileName,
        fileName: textureFileName,
        relativePath: normalizePath(path.join("stream", textureFile)),
      });
    });

    drawables.push(
      ClothingDrawableSchema.parse({
        id: buildDrawableId(options.pack.resourceName, baseName),
        label: baseName,
        category,
        componentId,
        drawableId: extractNumericId(baseName),
        gender,
        fileName,
        relativePath: normalizePath(path.join("stream", relativeFile)),
        textures,
        restrictedJobs: [],
        restrictedGangs: [],
        tags: [],
      }),
    );
  }

  for (const relativeFile of ytdFiles.sort((a, b) => a.localeCompare(b))) {
    const fileName = path.basename(relativeFile);
    const baseName = drawableBaseName(fileName);
    const alreadyIndexed = drawables.some((drawable) => drawableBaseName(drawable.fileName) === baseName);
    if (alreadyIndexed) {
      continue;
    }

    const inferenceSource = `${relativeFile} ${baseName}`;
    const gender = inferClothingGender(inferenceSource);
    const { category, componentId } = inferClothingCategory(inferenceSource);

    drawables.push(
      ClothingDrawableSchema.parse({
        id: buildDrawableId(options.pack.resourceName, baseName),
        label: baseName,
        category,
        componentId,
        drawableId: extractNumericId(baseName),
        gender,
        fileName,
        relativePath: normalizePath(path.join("stream", relativeFile)),
        textures: [
          ClothingTextureVariantSchema.parse({
            id: buildTextureId(baseName, fileName),
            textureId: extractNumericId(fileName),
            label: fileName,
            fileName,
            relativePath: normalizePath(path.join("stream", relativeFile)),
          }),
        ],
        restrictedJobs: [],
        restrictedGangs: [],
        tags: [],
      }),
    );
  }

  drawables.sort((a, b) => a.id.localeCompare(b.id));

  const genders = new Set(drawables.map((drawable) => drawable.gender));
  const genderScope =
    genders.size === 1 ? ClothingGenderSchema.parse([...genders][0]) : ("shared" as const);

  return {
    pack: {
      ...options.pack,
      drawables,
      genderScope,
      status: drawables.length > 0 ? "scanned" : "draft",
      metadata: {
        ...options.pack.metadata,
        lastScannedAt: new Date().toISOString(),
        scannedFileCount: files.length,
      },
    },
    scannedFiles: files.length,
  };
}

export function isLikelyClothingResource(resourceName: string): boolean {
  return /cloth|wear|outfit|skin|ped|eup|appearance|wardrobe/i.test(resourceName);
}
