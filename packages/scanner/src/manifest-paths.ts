import type { ResourceManifest } from "@fdt/schemas";

export function collectManifestReferencedPaths(manifest: ResourceManifest): string[] {
  if (manifest.type === "missing") {
    return [];
  }

  const paths = new Set<string>();

  for (const value of [
    ...manifest.clientScripts,
    ...manifest.serverScripts,
    ...manifest.sharedScripts,
    ...manifest.files,
    ...manifest.fileEntries,
    ...manifest.escrowIgnore,
  ]) {
    paths.add(value);
  }

  if (manifest.uiPage) {
    paths.add(manifest.uiPage);
  }

  if (manifest.loadscreen) {
    paths.add(manifest.loadscreen);
  }

  return [...paths];
}

export function collectManifestPackagedPaths(manifest: ResourceManifest): string[] {
  if (manifest.type === "missing") {
    return [];
  }

  return [...new Set([...manifest.files, ...manifest.fileEntries])];
}

export function isRemoteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function isExternalResourceReference(value: string): boolean {
  return value.startsWith("@");
}

export function isGlobPattern(value: string): boolean {
  return /[*?\[\]{}]/.test(value);
}
