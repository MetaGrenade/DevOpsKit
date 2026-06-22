export {
  detectServerArtifactBuild,
  type ArtifactBuildSource,
  type ResolvedArtifactBuild,
} from "./detect-artifact-build.js";

export {
  loadWorkspaceConfig,
  resolveWorkspaceConfigCandidates,
  FDT_ASSET_AUDITOR_MARKDOWN,
  FDT_ASSET_AUDITOR_REPORT,
  FDT_ASSET_SCAN_REPORT,
  FDT_CONTENT_DIR,
  FDT_CONTENT_VALIDATION_REPORT,
  FDT_EXPORTS_DIR,
  FDT_ITEMS_FILE,
  FDT_VEHICLES_FILE,
  FDT_BUSINESSES_FILE,
  FDT_MAPS_FILE,
  FDT_JOBS_FILE,
  FDT_GANGS_FILE,
  FDT_CLOTHING_PACKS_FILE,
  FDT_SHOPS_FILE,
  FDT_CRAFTING_FILE,
  FDT_CLOTHING_CONFLICTS_REPORT,
  FDT_CLOTHING_CHANGELOG,
  FDT_VEHICLE_AUDIT_REPORT,
  FDT_VEHICLE_SPAWN_TESTS,
  FDT_MAP_AUDIT_REPORT,
  FDT_MAP_TEST_POINTS,
  FDT_DEPENDENCY_GRAPH,
  FDT_NUI_SCHEMA_REPORT,
  FDT_ECONOMY_PROFILE_FILE,
  FDT_ECONOMY_SIMULATION_REPORT,
  FDT_ECONOMY_MARKDOWN,
  FDT_STATE_BAG_DIR,
  FDT_STATE_BAG_SNAPSHOTS_FILE,
  FDT_OUTPUT_DIR,
  FDT_RELEASES_DIR,
  FDT_RELEASES_REGISTRY,
  FDT_SECURITY_REPORT,
  FDT_SECURITY_BASELINE,
  FDT_SECURITY_SARIF,
  FDT_QA_DIR,
  FDT_QA_SCENARIOS_FILE,
  FDT_QA_RUNS_FILE,
  FDT_QA_VALIDATION_REPORT,
  FDT_CI_PIPELINE_REPORT,
  FDT_PERFORMANCE_DIR,
  FDT_PERFORMANCE_SNAPSHOTS_FILE,
  FDT_PERFORMANCE_COMPARISON_REPORT,
  FDT_PERFORMANCE_MARKDOWN,
  FDT_ENVIRONMENT_DIR,
  FDT_ENVIRONMENT_PROFILES_FILE,
  FDT_ENVIRONMENT_VALIDATION_REPORT,
  FDT_ENVIRONMENT_DIFF_REPORT,
  FDT_TXADMIN_EXPORT_DIR,
  FDT_REPORTS_DIR,
  FDT_RESOURCE_DOCTOR_REPORT,
  FDT_RESOURCE_SCAN_REPORT,
  FDT_ZONES_DIR,
  FDT_ZONES_FILE,
  FDT_WORLD_DIR,
  FDT_BLIPS_FILE,
  FDT_PROPS_FILE,
  FDT_DOORS_FILE,
  type WorkspaceDiscoveryResult,
  type WorkspaceLoaderOptions,
} from "./workspace.js";

export {
  deleteItem,
  listItems,
  loadContentRegistry,
  resolveItemsPath,
  saveContentRegistry,
  toDomainModel,
  upsertItem,
} from "./content-store.js";

export {
  createShopFromZone,
  deleteShop,
  listShops,
  loadShopRegistry,
  resolveShopsPath,
  saveShopRegistry,
  upsertShop,
} from "./shop-store.js";

export {
  deleteCraftingRecipe,
  listCraftingRecipes,
  loadCraftingRegistry,
  resolveCraftingPath,
  saveCraftingRegistry,
  upsertCraftingRecipe,
} from "./crafting-store.js";

export {
  compareHandlingMetrics,
  extractHandlingBlock,
  parseHandlingMeta,
  parseVehicleDisplayName,
  parseVehicleModelNames,
} from "./handling-meta.js";

export {
  isLikelyVehicleResource,
  loadHandlingMetricsForSpawn,
  scanVehicleResource,
  scanWorkspaceVehicles,
  type ScanVehicleResourceResult,
  type ScanWorkspaceVehiclesOptions,
} from "./scan-vehicle-resource.js";

export {
  deleteVehicle,
  listVehicles,
  loadVehicleRegistry,
  resolveVehiclesPath,
  saveVehicleRegistry,
  upsertVehicle,
} from "./vehicle-store.js";

export {
  createBusinessFromZone,
  deleteBusiness,
  listBusinesses,
  loadBusinessRegistry,
  mapZonePurposeToBusinessType,
  resolveBusinessesPath,
  saveBusinessRegistry,
  upsertBusiness,
} from "./business-store.js";

export {
  createDefaultMapChecklist,
  createMapPackage,
  deleteMapPackage,
  deriveMapStatus,
  deriveMapIdFromResourceName,
  ensureUniqueMapId,
  evaluateMapChecklist,
  listMapPackages,
  loadMapRegistry,
  refreshMapChecklist,
  resolveMapsPath,
  saveMapRegistry,
  upsertMapPackage,
  sanitizeMapId,
} from "./map-store.js";

export {
  generateMapResource,
  writeMapResource,
  type MapResourceFile,
  type WriteMapResourceOptions,
} from "./map-generator.js";

export {
  isLikelyMapResource,
  hasCoreMapAssets,
  isVehicleOnlyResource,
  isMapResourceCandidate,
  scanMapResource,
  scanWorkspaceMaps,
  syncMapRegistryFromScan,
  type ScanMapResourceResult,
  type ScanWorkspaceMapsOptions,
} from "./scan-map-resource.js";

export { resolveResourceDirectory } from "./resource-path.js";

export {
  buildDependencyGraph,
  buildWorkspaceDependencyGraph,
  findGraphEvents,
  findImpactedResources,
  type BuildDependencyGraphOptions,
} from "./build-dependency-graph.js";

export {
  renderDependencyGraphDot,
  renderDependencyGraphHtml,
} from "./render-dependency-graph.js";

export { loadDomainModel } from "./domain-model.js";

export {
  deriveEconomyActivities,
  loadEconomyProfile,
  loadEconomySimulationReport,
  renderEconomyMarkdown,
  runEconomySimulation,
  saveEconomyProfile,
  saveEconomySimulationReport,
  simulateEconomy,
  writeEconomyMarkdownReport,
} from "./economy-simulator.js";

export {
  importStateBagExport,
  listStateBagSnapshots,
  loadStateBagRegistry,
  saveStateBagRegistry,
} from "./state-bag-store.js";

export {
  deleteBlip,
  deleteDoor,
  deleteProp,
  importBlipExport,
  importDoorExport,
  importPropExport,
  importWorldExport,
  listBlips,
  listDoors,
  listProps,
  loadBlipRegistry,
  loadDoorRegistry,
  loadPropRegistry,
  resolveBlipsPath,
  resolveDoorsPath,
  resolvePropsPath,
  upsertBlip,
  upsertDoor,
  upsertProp,
} from "./world-store.js";

export {
  buildEnvironmentDiffReport,
  buildResourceEnsureOrder,
  compareEnvironmentProfiles,
  generateServerCfg,
  generateTxAdminRecipe,
  renderEnvironmentDiffMarkdown,
  renderServerCfgContent,
  renderTxAdminRecipeContent,
  resolveProfileForGeneration,
  saveEnvironmentDiffReport,
  saveEnvironmentValidationReport,
  validateEnvironmentProfile,
} from "./environment-builder.js";

export {
  getEnvironmentProfile,
  initEnvironmentProfiles,
  listEnvironmentProfiles,
  loadEnvironmentRegistry,
  prioritizeCoreEnsureOrder,
  resolveEnvironmentProfile,
  resolveEnvironmentProfilesPath,
  saveEnvironmentRegistry,
  upsertEnvironmentProfile,
} from "./environment-store.js";

export {
  createJobFromZone,
  deleteJob,
  listJobs,
  loadJobRegistry,
  mapZonePurposeToJobType,
  resolveJobsPath,
  saveJobRegistry,
  upsertJob,
} from "./job-store.js";

export {
  createClothingPack,
  deleteClothingPack,
  getClothingPack,
  listClothingPacks,
  loadClothingRegistry,
  resolveClothingPacksPath,
  saveClothingRegistry,
  upsertClothingPack,
} from "./clothing-store.js";

export {
  refreshClothingPacksForCi,
  type RefreshClothingPacksOptions,
} from "./clothing-ci.js";

export {
  generateNuiResource,
  writeNuiResource,
  type GenerateNuiResourceOptions,
  type NuiResourceFile,
  type WriteNuiResourceOptions,
} from "./nui-generator.js";

export {
  addNuiCallback,
  addNuiMessage,
  assertNuiResource,
  discoverNuiResources,
  loadNuiBridgeRegistry,
  normalizeNuiBridgeRegistry,
  resolveNuiResourceRoot,
  sanitizeBridgeName,
  sanitizeResourceName,
  syncNuiBridgeSchemas,
  syncWorkspaceNuiSchemas,
  validateNuiSchemaSync,
  validateWorkspaceNuiSchemas,
} from "./nui-bridge.js";

export {
  inferClothingCategory,
  inferClothingGender,
  isLikelyClothingResource,
  scanClothingPack,
  type ScanClothingPackOptions,
  type ScanClothingPackResult,
} from "./scan-clothing-pack.js";

export {
  createGangFromZone,
  deleteGang,
  listGangs,
  loadGangRegistry,
  mapZonePurposeToGangType,
  resolveGangsPath,
  saveGangRegistry,
  upsertGang,
} from "./gang-store.js";

export {
  attachPerformanceSnapshotToRelease,
  comparePerformanceSnapshots,
  getPerformanceSnapshot,
  importPerformanceSnapshot,
  listPerformanceSnapshots,
  loadPerformanceComparisonReport,
  loadPerformanceSnapshotRegistry,
  renderPerformanceMarkdown,
  resolvePerformanceSnapshotRef,
  resolvePerformanceSnapshotsPath,
  savePerformanceComparisonReport,
  savePerformanceSnapshotRegistry,
  summarizePerformanceForRelease,
  type PerformanceReleaseSummary,
} from "./perf-store.js";

export {
  detectFrameworkProfile,
  discoverResourceNames,
  recommendAdapters,
  type DetectFrameworkProfileOptions,
} from "./detect-framework.js";

export {
  updateWorkspaceFrameworkProfile,
} from "./update-workspace-framework.js";

export {
  buildWorkspaceManifest,
  detectReleaseChanges,
  fileExistsAndFresh,
  type ReleaseChangeSet,
} from "./detect-release-changes.js";

export { renderReleaseChangelog } from "./render-changelog.js";

export {
  createRelease,
  getRelease,
  listReleases,
  loadReleaseRegistry,
  resolveReleaseBundleDir,
  resolveReleasesRegistryPath,
  saveReleaseRegistry,
  updateReleaseStatus,
} from "./release-store.js";

export {
  buildReleaseChecklist,
  buildReleaseDiffReport,
  compareReleases,
  exportReleaseBundle,
  loadReleaseBundleChangelog,
  renderReleaseChecklistMarkdown,
  renderReleaseDiffMarkdown,
  saveReleaseChecklistReport,
  saveReleaseDiffReport,
} from "./release-diff.js";

export {
  attachQaRunToRelease,
  createQaRun,
  deleteQaScenario,
  deriveQaRunStatus,
  getQaRun,
  importQaRunExport,
  listQaRuns,
  listQaRunsForRelease,
  listQaScenarios,
  loadQaRunRegistry,
  loadQaScenarioRegistry,
  resolveQaRunsPath,
  resolveQaScenariosPath,
  saveQaRunRegistry,
  saveQaScenarioRegistry,
  summarizeQaForRelease,
  updateQaRunStep,
  upsertQaScenario,
  type QaReleaseSummary,
} from "./qa-store.js";

export {
  deleteZone,
  importZoneExport,
  listZones,
  loadZoneRegistry,
  resolveZonesPath,
  saveZoneRegistry,
  upsertZone,
} from "./zone-store.js";

export {
  checkWorkspacePaths,
  createWorkspaceOnDisk,
  createWorkspaceRecord,
  preferWorkspaceRelativePath,
  resolveWorkspacePath,
  resolveWorkspacePaths,
  type CreatedWorkspaceResult,
} from "./workspace-manager.js";
