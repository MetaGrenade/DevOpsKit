import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  CreateReleaseInputSchema,
  ReleaseRegistrySchema,
  ReleaseSchema,
  ResourceDoctorReportSchema,
  RollbackManifestSchema,
  UpdateReleaseStatusInputSchema,
  ContentValidationReportSchema,
  AssetAuditorReportSchema,
  type CreateReleaseInput,
  type Release,
  type ReleaseRegistry,
  type UpdateReleaseStatusInput,
} from "@fdt/schemas";
import {
  FDT_ASSET_AUDITOR_REPORT,
  FDT_CONTENT_VALIDATION_REPORT,
  FDT_RELEASES_DIR,
  FDT_RELEASES_REGISTRY,
  FDT_RESOURCE_DOCTOR_REPORT,
} from "./workspace.js";
import { detectReleaseChanges } from "./detect-release-changes.js";
import { renderReleaseChangelog } from "./render-changelog.js";
import type { Workspace } from "@fdt/schemas";

function emptyRegistry(): ReleaseRegistry {
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    releases: [],
    baselineManifest: {},
  };
}

export function resolveReleasesRegistryPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, FDT_RELEASES_REGISTRY);
}

export function resolveReleaseBundleDir(workspaceRoot: string, version: string): string {
  return path.join(workspaceRoot, FDT_RELEASES_DIR, version);
}

export async function loadReleaseRegistry(workspaceRoot: string): Promise<ReleaseRegistry> {
  const registryPath = resolveReleasesRegistryPath(workspaceRoot);
  if (!existsSync(registryPath)) {
    return emptyRegistry();
  }

  const raw = await readFile(registryPath, "utf8");
  return ReleaseRegistrySchema.parse(JSON.parse(raw));
}

export async function saveReleaseRegistry(
  workspaceRoot: string,
  registry: ReleaseRegistry,
): Promise<string> {
  const registryPath = resolveReleasesRegistryPath(workspaceRoot);
  await mkdir(path.dirname(registryPath), { recursive: true });

  const payload: ReleaseRegistry = {
    ...registry,
    updatedAt: new Date().toISOString(),
  };

  await writeFile(registryPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return registryPath;
}

export async function listReleases(workspaceRoot: string): Promise<Release[]> {
  const registry = await loadReleaseRegistry(workspaceRoot);
  return [...registry.releases].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getRelease(workspaceRoot: string, releaseId: string): Promise<Release | null> {
  const registry = await loadReleaseRegistry(workspaceRoot);
  return registry.releases.find((release) => release.id === releaseId || release.version === releaseId) ?? null;
}

async function loadValidationSummary(workspaceRoot: string) {
  const resourceDoctorPath = path.join(workspaceRoot, FDT_RESOURCE_DOCTOR_REPORT);
  if (!existsSync(resourceDoctorPath)) {
    throw new Error(
      `Validation report missing: ${FDT_RESOURCE_DOCTOR_REPORT}. Run \`fdt validate resources\` first.`,
    );
  }

  const resourceDoctor = ResourceDoctorReportSchema.parse(
    JSON.parse(await readFile(resourceDoctorPath, "utf8")),
  );

  let contentValidationGeneratedAt: string | undefined;
  const contentValidationPath = path.join(workspaceRoot, FDT_CONTENT_VALIDATION_REPORT);
  if (existsSync(contentValidationPath)) {
    const contentReport = ContentValidationReportSchema.parse(
      JSON.parse(await readFile(contentValidationPath, "utf8")),
    );
    contentValidationGeneratedAt = contentReport.generatedAt;
  }

  let assetAuditorGeneratedAt: string | undefined;
  const assetAuditorPath = path.join(workspaceRoot, FDT_ASSET_AUDITOR_REPORT);
  if (existsSync(assetAuditorPath)) {
    const assetReport = AssetAuditorReportSchema.parse(
      JSON.parse(await readFile(assetAuditorPath, "utf8")),
    );
    assetAuditorGeneratedAt = assetReport.generatedAt;
  }

  return {
    summary: {
      errors: resourceDoctor.summary.errors,
      warnings: resourceDoctor.summary.warnings,
      passed: resourceDoctor.summary.passed,
      resourceDoctorGeneratedAt: resourceDoctor.generatedAt,
      contentValidationGeneratedAt,
      assetAuditorGeneratedAt,
    },
    resourceDoctorPath,
    contentValidationPath: existsSync(contentValidationPath) ? contentValidationPath : null,
    assetAuditorPath: existsSync(assetAuditorPath) ? assetAuditorPath : null,
  };
}

export async function createRelease(options: {
  workspaceRoot: string;
  workspace: Workspace;
  input: CreateReleaseInput;
}): Promise<Release> {
  const parsedInput = CreateReleaseInputSchema.parse(options.input);
  const { workspaceRoot, workspace } = options;

  const registry = await loadReleaseRegistry(workspaceRoot);
  if (registry.releases.some((release) => release.version === parsedInput.version)) {
    throw new Error(`Release version already exists: ${parsedInput.version}`);
  }

  const validation = await loadValidationSummary(workspaceRoot);
  if (validation.summary.errors > 0 && !parsedInput.allowValidationErrors) {
    throw new Error(
      `Validation report has ${validation.summary.errors} error(s). Fix issues or pass allowValidationErrors.`,
    );
  }

  const previousRelease = [...registry.releases].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )[0];

  const changes = await detectReleaseChanges({
    workspaceRoot,
    workspace,
    previousSourceRef: previousRelease?.sourceRef ?? null,
    previousManifest: registry.baselineManifest,
  });

  const releaseId = `rel_${parsedInput.version.replace(/\./g, "_")}`;
  const createdAt = new Date().toISOString();
  const bundleDir = resolveReleaseBundleDir(workspaceRoot, parsedInput.version);
  const bundleRelative = path.posix.join(FDT_RELEASES_DIR, parsedInput.version);

  const changelogMarkdown = renderReleaseChangelog({
    release: {
      version: parsedInput.version,
      targetEnvironment: parsedInput.targetEnvironment,
      validationSummary: validation.summary,
    },
    changes,
    workspaceName: workspace.name,
    detectionMethod: changes.detectionMethod,
  });

  const rollbackManifest = RollbackManifestSchema.parse({
    schemaVersion: 1,
    releaseVersion: parsedInput.version,
    createdAt,
    previousBaseline: registry.baselineManifest,
    changedResources: changes.changedResources,
    changedContent: changes.changedContent,
    changedZones: changes.changedZones,
    changedAssets: changes.changedAssets,
  });

  const rollbackRelative = path.posix.join(bundleRelative, "rollback-manifest.json");

  const release = ReleaseSchema.parse({
    id: releaseId,
    version: parsedInput.version,
    createdAt,
    createdBy: parsedInput.createdBy,
    sourceRef: changes.sourceRef ?? undefined,
    targetEnvironment: parsedInput.targetEnvironment,
    status: "validated",
    statusHistory: [
      {
        status: "validated",
        changedAt: createdAt,
        changedBy: parsedInput.createdBy,
        note: "Release created from validation reports",
      },
    ],
    changedResources: changes.changedResources,
    changedContent: changes.changedContent,
    changedZones: changes.changedZones,
    changedAssets: changes.changedAssets,
    changedDatabaseMigrations: changes.changedDatabaseMigrations,
    validationSummary: validation.summary,
    changelogMarkdown,
    rollbackManifest: rollbackRelative,
    bundlePath: bundleRelative,
  });

  await mkdir(path.join(bundleDir, "validation"), { recursive: true });
  await writeFile(path.join(bundleDir, "release.json"), `${JSON.stringify(release, null, 2)}\n`, "utf8");
  await writeFile(path.join(bundleDir, "CHANGELOG.md"), `${changelogMarkdown}\n`, "utf8");
  await writeFile(
    path.join(bundleDir, "rollback-manifest.json"),
    `${JSON.stringify(rollbackManifest, null, 2)}\n`,
    "utf8",
  );

  await writeFile(
    path.join(bundleDir, "validation", "resource-doctor.json"),
    await readFile(validation.resourceDoctorPath, "utf8"),
    "utf8",
  );

  if (validation.contentValidationPath) {
    await writeFile(
      path.join(bundleDir, "validation", "content-validation.json"),
      await readFile(validation.contentValidationPath, "utf8"),
      "utf8",
    );
  }

  if (validation.assetAuditorPath) {
    await writeFile(
      path.join(bundleDir, "validation", "asset-auditor.json"),
      await readFile(validation.assetAuditorPath, "utf8"),
      "utf8",
    );
  }

  registry.releases.push(release);
  registry.baselineManifest = changes.currentManifest;
  registry.releases.sort((a, b) => a.version.localeCompare(b.version));
  await saveReleaseRegistry(workspaceRoot, registry);

  return release;
}

export async function updateReleaseStatus(
  workspaceRoot: string,
  releaseId: string,
  input: UpdateReleaseStatusInput,
): Promise<Release> {
  const parsed = UpdateReleaseStatusInputSchema.parse(input);
  const registry = await loadReleaseRegistry(workspaceRoot);
  const index = registry.releases.findIndex(
    (release) => release.id === releaseId || release.version === releaseId,
  );

  if (index < 0) {
    throw new Error(`Release not found: ${releaseId}`);
  }

  const existing = registry.releases[index]!;
  const changedAt = new Date().toISOString();
  const updated: Release = ReleaseSchema.parse({
    ...existing,
    status: parsed.status,
    statusHistory: [
      ...existing.statusHistory,
      {
        status: parsed.status,
        changedAt,
        changedBy: parsed.changedBy,
        note: parsed.note,
      },
    ],
  });

  registry.releases[index] = updated;
  await saveReleaseRegistry(workspaceRoot, registry);

  if (updated.bundlePath) {
    const bundleDir = path.join(workspaceRoot, updated.bundlePath);
    await mkdir(bundleDir, { recursive: true });
    await writeFile(path.join(bundleDir, "release.json"), `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  }

  return updated;
}
