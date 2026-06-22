import type {
  AdapterExportResult,
  AdapterId,
  FdtDomainModel,
} from "@fdt/schemas";

export type AdapterCapability =
  | "items"
  | "vehicles"
  | "businesses"
  | "maps"
  | "jobs"
  | "gangs"
  | "clothing"
  | "shops"
  | "crafting";

export interface AdapterExportOptions {
  dryRun?: boolean;
  generatedAt?: string;
  /** When true, ESX adapter also emits ox_inventory merge file */
  includeOxInventory?: boolean;
}

export interface FdtAdapter {
  id: AdapterId;
  label: string;
  version: string;
  capabilities: AdapterCapability[];
  export(model: FdtDomainModel, options?: AdapterExportOptions): Promise<AdapterExportResult>;
}
