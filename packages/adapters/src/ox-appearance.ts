import type { AdapterExportOptions, FdtAdapter } from "./types.js";
import { renderOxAppearanceClothingJson } from "./clothing-render.js";

export const oxAppearanceAdapter: FdtAdapter = {
  id: "ox-appearance",
  label: "ox_appearance / illenium-appearance",
  version: "1.0.0",
  capabilities: ["clothing"],

  async export(model, options: AdapterExportOptions = {}) {
    const generatedAt = options.generatedAt ?? new Date().toISOString();

    if (model.clothingPacks.length === 0) {
      return {
        adapterId: "ox-appearance",
        dryRun: options.dryRun ?? false,
        files: [],
      };
    }

    return {
      adapterId: "ox-appearance",
      dryRun: options.dryRun ?? false,
      files: [
        {
          relativePath: "ox_appearance/data/fdt_clothing.json",
          content: renderOxAppearanceClothingJson(model, generatedAt),
        },
        {
          relativePath: "illenium-appearance/shared/fdt_clothing.json",
          content: renderOxAppearanceClothingJson(model, generatedAt),
        },
      ],
    };
  },
};
