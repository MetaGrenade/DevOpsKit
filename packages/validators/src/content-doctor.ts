import { existsSync } from "node:fs";
import path from "node:path";
import { loadContentRegistry, loadCraftingRegistry, loadShopRegistry } from "@fdt/core";
import type { ContentValidationFinding, ContentValidationReport } from "@fdt/schemas";

export interface ValidateContentOptions {
  workspaceRoot: string;
  workspaceName: string;
  iconsRoot?: string;
}

function countBySeverity(findings: ContentValidationFinding[]) {
  return {
    errors: findings.filter((f) => f.severity === "error").length,
    warnings: findings.filter((f) => f.severity === "warning").length,
    info: findings.filter((f) => f.severity === "info").length,
  };
}

export async function validateContent(
  options: ValidateContentOptions,
): Promise<ContentValidationReport> {
  const [registry, shopRegistry, craftingRegistry] = await Promise.all([
    loadContentRegistry(options.workspaceRoot),
    loadShopRegistry(options.workspaceRoot),
    loadCraftingRegistry(options.workspaceRoot),
  ]);
  const findings: ContentValidationFinding[] = [];
  const seenIds = new Map<string, number>();
  const itemIds = new Set(registry.items.map((item) => item.id));

  for (const item of registry.items) {
    const count = seenIds.get(item.id) ?? 0;
    seenIds.set(item.id, count + 1);

    if (count > 0) {
      findings.push({
        id: `duplicate-item-${item.id}-${count}`,
        severity: "error",
        code: "content.duplicate_item_id",
        message: `Duplicate item id "${item.id}" appears ${count + 1} times in the registry`,
        itemId: item.id,
      });
    }

    if (!item.label.trim()) {
      findings.push({
        id: `missing-label-${item.id}`,
        severity: "error",
        code: "content.missing_label",
        message: `Item "${item.id}" is missing a label`,
        itemId: item.id,
      });
    }

    const iconRef = item.icon ?? `${item.id}.png`;

    if (options.iconsRoot) {
      const iconPath = path.join(options.iconsRoot, iconRef);
      if (!existsSync(iconPath)) {
        findings.push({
          id: `missing-icon-${item.id}`,
          severity: "warning",
          code: "content.missing_icon",
          message: `Icon file not found for item "${item.id}": ${iconPath}`,
          itemId: item.id,
          details: { iconPath },
        });
      }
    } else if (!item.icon) {
      findings.push({
        id: `default-icon-${item.id}`,
        severity: "info",
        code: "content.default_icon",
        message: `Item "${item.id}" has no icon; exports will use "${item.id}.png"`,
        itemId: item.id,
      });
    }
  }

  const seenShopIds = new Map<string, number>();
  for (const shop of shopRegistry.shops) {
    const count = seenShopIds.get(shop.id) ?? 0;
    seenShopIds.set(shop.id, count + 1);

    if (count > 0) {
      findings.push({
        id: `duplicate-shop-${shop.id}-${count}`,
        severity: "error",
        code: "content.duplicate_shop_id",
        message: `Duplicate shop id "${shop.id}" appears ${count + 1} times in the registry`,
        shopId: shop.id,
      });
    }

    if (shop.items.length === 0) {
      findings.push({
        id: `empty-shop-${shop.id}`,
        severity: "warning",
        code: "content.empty_shop_inventory",
        message: `Shop "${shop.id}" has no inventory items`,
        shopId: shop.id,
      });
    }

    for (const entry of shop.items) {
      if (!itemIds.has(entry.itemId)) {
        findings.push({
          id: `shop-missing-item-${shop.id}-${entry.itemId}`,
          severity: "error",
          code: "content.shop_missing_item",
          message: `Shop "${shop.id}" references missing item "${entry.itemId}"`,
          shopId: shop.id,
          itemId: entry.itemId,
        });
      }

      if (entry.price < 0) {
        findings.push({
          id: `shop-invalid-price-${shop.id}-${entry.itemId}`,
          severity: "error",
          code: "content.shop_invalid_price",
          message: `Shop "${shop.id}" item "${entry.itemId}" has invalid price ${entry.price}`,
          shopId: shop.id,
          itemId: entry.itemId,
        });
      }
    }
  }

  const seenRecipeIds = new Map<string, number>();
  for (const recipe of craftingRegistry.recipes) {
    const count = seenRecipeIds.get(recipe.id) ?? 0;
    seenRecipeIds.set(recipe.id, count + 1);

    if (count > 0) {
      findings.push({
        id: `duplicate-recipe-${recipe.id}-${count}`,
        severity: "error",
        code: "content.duplicate_recipe_id",
        message: `Duplicate crafting recipe id "${recipe.id}" appears ${count + 1} times`,
        recipeId: recipe.id,
      });
    }

    for (const input of recipe.inputs) {
      if (!itemIds.has(input.itemId)) {
        findings.push({
          id: `recipe-input-missing-${recipe.id}-${input.itemId}`,
          severity: "error",
          code: "content.recipe_missing_input_item",
          message: `Recipe "${recipe.id}" input references missing item "${input.itemId}"`,
          recipeId: recipe.id,
          itemId: input.itemId,
        });
      }
    }

    for (const output of recipe.outputs) {
      if (!itemIds.has(output.itemId)) {
        findings.push({
          id: `recipe-output-missing-${recipe.id}-${output.itemId}`,
          severity: "error",
          code: "content.recipe_missing_output_item",
          message: `Recipe "${recipe.id}" output references missing item "${output.itemId}"`,
          recipeId: recipe.id,
          itemId: output.itemId,
        });
      }
    }
  }

  const severityCounts = countBySeverity(findings);

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    workspaceName: options.workspaceName,
    workspaceRoot: options.workspaceRoot,
    summary: {
      itemsChecked: registry.items.length,
      shopsChecked: shopRegistry.shops.length,
      recipesChecked: craftingRegistry.recipes.length,
      ...severityCounts,
    },
    findings,
  };
}
