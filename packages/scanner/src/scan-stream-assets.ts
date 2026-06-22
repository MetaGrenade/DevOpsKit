import { createHash } from "node:crypto";
import { stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import {
  STREAM_ASSET_EXTENSIONS,
  StreamAssetExtensionSchema,
  type StreamAsset,
  type StreamAssetExtension,
  type Workspace,
} from "@fdt/schemas";
import { scanResources, type ScanResourcesResult } from "./scan-resources.js";

export interface ScanStreamAssetsOptions {
  workspaceRoot: string;
  workspace: Workspace;
  scanResult?: ScanResourcesResult;
}

export interface ScanStreamAssetsResult {
  assets: StreamAsset[];
  resourceSummaries: Array<{
    resource: string;
    resourcePath: string;
    assetCount: number;
    totalBytes: number;
    ytdBytes: number;
  }>;
}

const EXTENSION_GLOB = `*{${STREAM_ASSET_EXTENSIONS.join(",")}}`;

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

export function buildStreamAssetId(resourceName: string, relativePath: string): string {
  const payload = `${resourceName}\0${normalizePath(relativePath).toLowerCase()}`;
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

function extensionFromFileName(fileName: string): StreamAssetExtension | null {
  const lower = fileName.toLowerCase();
  for (const extension of STREAM_ASSET_EXTENSIONS) {
    if (lower.endsWith(extension)) {
      return StreamAssetExtensionSchema.parse(extension);
    }
  }
  return null;
}

async function scanResourceStreamFolder(
  workspaceRoot: string,
  resourceName: string,
  resourcePath: string,
): Promise<StreamAsset[]> {
  const absoluteResourcePath = path.resolve(workspaceRoot, resourcePath);
  const streamDir = path.join(absoluteResourcePath, "stream");

  if (!existsSync(streamDir)) {
    return [];
  }

  const files = await fg(`**/${EXTENSION_GLOB}`, {
    cwd: streamDir,
    onlyFiles: true,
    absolute: true,
    dot: false,
  });

  const assets: StreamAsset[] = [];

  for (const absoluteFile of files.sort((a, b) => a.localeCompare(b))) {
    const relativeWithinStream = normalizePath(path.relative(streamDir, absoluteFile));
    const relativePath = normalizePath(path.join("stream", relativeWithinStream));
    const fileName = path.basename(absoluteFile);
    const extension = extensionFromFileName(fileName);

    if (!extension) {
      continue;
    }

    const fileStat = await stat(absoluteFile);
    assets.push({
      id: buildStreamAssetId(resourceName, relativePath),
      resource: resourceName,
      resourcePath: normalizePath(resourcePath),
      relativePath,
      fileName,
      extension,
      sizeBytes: fileStat.size,
    });
  }

  return assets;
}

function summarizeResources(assets: StreamAsset[]): ScanStreamAssetsResult["resourceSummaries"] {
  const byResource = new Map<string, ScanStreamAssetsResult["resourceSummaries"][number]>();

  for (const asset of assets) {
    const existing = byResource.get(asset.resource) ?? {
      resource: asset.resource,
      resourcePath: asset.resourcePath,
      assetCount: 0,
      totalBytes: 0,
      ytdBytes: 0,
    };

    existing.assetCount += 1;
    existing.totalBytes += asset.sizeBytes;
    if (asset.extension === ".ytd") {
      existing.ytdBytes += asset.sizeBytes;
    }

    byResource.set(asset.resource, existing);
  }

  return [...byResource.values()].sort((a, b) => b.totalBytes - a.totalBytes);
}

export async function scanStreamAssets(
  options: ScanStreamAssetsOptions,
): Promise<ScanStreamAssetsResult> {
  const scanResult =
    options.scanResult ??
    (await scanResources({
      workspaceRoot: options.workspaceRoot,
      workspace: options.workspace,
    }));

  const assets: StreamAsset[] = [];

  for (const resource of scanResult.resources) {
    const resourceAssets = await scanResourceStreamFolder(
      options.workspaceRoot,
      resource.name,
      resource.path,
    );
    assets.push(...resourceAssets);
  }

  assets.sort((a, b) => {
    const resourceCompare = a.resource.localeCompare(b.resource);
    if (resourceCompare !== 0) {
      return resourceCompare;
    }
    return a.relativePath.localeCompare(b.relativePath);
  });

  return {
    assets,
    resourceSummaries: summarizeResources(assets),
  };
}
