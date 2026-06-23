import { useEffect, useMemo, useState } from "react";
import {
  EmptyState,
  PageIntro,
  PageStack,
  Panel,
} from "../components/ui/page";
import { SkeletonText } from "../components/ui/primitives";
import DataTable, { type DataTableColumn } from "../components/ui/DataTable";
import Toolbar from "../components/ui/Toolbar";
import { useToast } from "../components/ui/Toast";
import type { WorkspaceWithConfig } from "../types/api";

interface ItemOption {
  id: string;
  label: string;
}

interface ShopItemEntry {
  itemId: string;
  price: number;
  metadata: Record<string, unknown>;
}

interface Shop {
  id: string;
  label: string;
  type: string;
  currency: string;
  items: ShopItemEntry[];
}

interface CraftingRecipe {
  id: string;
  label: string;
  bench?: string;
  inputs: Array<{ itemId: string; amount: number }>;
  outputs: Array<{ itemId: string; amount: number }>;
}

const EMPTY_SHOP = {
  id: "",
  label: "",
  type: "general",
  currency: "cash",
  itemId: "",
  itemPrice: "10",
};

const EMPTY_RECIPE = {
  id: "",
  label: "",
  bench: "",
  inputItemId: "",
  inputAmount: "1",
  outputItemId: "",
  outputAmount: "1",
};

export default function CommercePage() {
  const { notify } = useToast();
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceWithConfig | null>(null);
  const [tab, setTab] = useState<"shops" | "crafting">("shops");
  const [items, setItems] = useState<ItemOption[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [recipes, setRecipes] = useState<CraftingRecipe[]>([]);
  const [shopForm, setShopForm] = useState(EMPTY_SHOP);
  const [recipeForm, setRecipeForm] = useState(EMPTY_RECIPE);
  const [shopFilter, setShopFilter] = useState("");
  const [recipeFilter, setRecipeFilter] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);

    try {
      const wsRes = await fetch("/api/v1/workspaces/active");
      if (wsRes.status === 404) {
        setActiveWorkspace(null);
        setItems([]);
        setShops([]);
        setRecipes([]);
        return;
      }
      if (!wsRes.ok) throw new Error("Failed to load active workspace");
      setActiveWorkspace((await wsRes.json()) as WorkspaceWithConfig);

      const [itemsRes, shopsRes, recipesRes] = await Promise.all([
        fetch("/api/v1/content/items"),
        fetch("/api/v1/content/shops"),
        fetch("/api/v1/content/crafting"),
      ]);

      if (itemsRes.ok) {
        const data = (await itemsRes.json()) as { items: ItemOption[] };
        setItems(data.items);
      }
      if (shopsRes.ok) {
        const data = (await shopsRes.json()) as { shops: Shop[] };
        setShops(data.shops);
      }
      if (recipesRes.ok) {
        const data = (await recipesRes.json()) as { recipes: CraftingRecipe[] };
        setRecipes(data.recipes);
      }
    } catch (error) {
      notify({
        title: "Failed to load commerce data",
        message: error instanceof Error ? error.message : String(error),
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleValidate() {
    const response = await fetch("/api/v1/content/validate", { method: "POST" });
    const payload = (await response.json()) as {
      message?: string;
      report?: { summary: { errors: number; warnings: number; shopsChecked: number; recipesChecked: number } };
    };
    if (!response.ok) {
      notify({ title: "Validation failed", message: payload.message ?? undefined, tone: "error" });
      return;
    }
    const summary = payload.report?.summary;
    notify({
      title: "Validation complete",
      message: summary
        ? `${summary.errors} errors · ${summary.warnings} warnings · ${summary.shopsChecked} shops · ${summary.recipesChecked} recipes`
        : undefined,
      tone: summary && summary.errors > 0 ? "warning" : "success",
    });
  }

  async function handleSaveShop(event: React.FormEvent) {
    event.preventDefault();

    const response = await fetch("/api/v1/content/shops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: shopForm.id.trim(),
        label: shopForm.label.trim(),
        type: shopForm.type,
        currency: shopForm.currency,
        locations: [],
        items: shopForm.itemId.trim()
          ? [{ itemId: shopForm.itemId.trim(), price: Number(shopForm.itemPrice) || 0, metadata: {} }]
          : [],
        metadata: {},
      }),
    });

    const payload = (await response.json()) as { message?: string };
    if (!response.ok) {
      notify({ title: "Failed to save shop", message: payload.message ?? undefined, tone: "error" });
      return;
    }

    setShopForm(EMPTY_SHOP);
    notify({ title: `Saved shop ${shopForm.id.trim()}`, tone: "success" });
    await loadData();
  }

  async function handleSaveRecipe(event: React.FormEvent) {
    event.preventDefault();

    const response = await fetch("/api/v1/content/crafting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: recipeForm.id.trim(),
        label: recipeForm.label.trim(),
        bench: recipeForm.bench.trim() || undefined,
        inputs: [{ itemId: recipeForm.inputItemId.trim(), amount: Number(recipeForm.inputAmount) || 1 }],
        outputs: [{ itemId: recipeForm.outputItemId.trim(), amount: Number(recipeForm.outputAmount) || 1 }],
        metadata: {},
      }),
    });

    const payload = (await response.json()) as { message?: string };
    if (!response.ok) {
      notify({ title: "Failed to save recipe", message: payload.message ?? undefined, tone: "error" });
      return;
    }

    setRecipeForm(EMPTY_RECIPE);
    notify({ title: `Saved recipe ${recipeForm.id.trim()}`, tone: "success" });
    await loadData();
  }

  const shopColumns: Array<DataTableColumn<Shop>> = useMemo(
    () => [
      {
        key: "label",
        header: "Shop",
        render: (shop) => (
          <div>
            <p className="font-medium">{shop.label}</p>
            <p className="text-xs text-[var(--color-muted)]">{shop.id}</p>
          </div>
        ),
      },
      { key: "type", header: "Type", render: (shop) => shop.type },
      { key: "currency", header: "Currency", render: (shop) => shop.currency },
      { key: "items", header: "Items", align: "right", render: (shop) => shop.items.length },
    ],
    [],
  );

  const recipeColumns: Array<DataTableColumn<CraftingRecipe>> = useMemo(
    () => [
      {
        key: "label",
        header: "Recipe",
        render: (recipe) => (
          <div>
            <p className="font-medium">{recipe.label}</p>
            <p className="text-xs text-[var(--color-muted)]">{recipe.id}</p>
          </div>
        ),
      },
      {
        key: "inputs",
        header: "Inputs → Outputs",
        render: (recipe) =>
          `${recipe.inputs.map((input) => `${input.amount}x ${input.itemId}`).join(" + ")} → ${recipe.outputs.map((output) => `${output.amount}x ${output.itemId}`).join(", ")}`,
      },
    ],
    [],
  );

  const filteredShops = useMemo(() => {
    const normalized = shopFilter.trim().toLowerCase();
    if (!normalized) return shops;
    return shops.filter((shop) =>
      [shop.label, shop.id, shop.type, shop.currency].join(" ").toLowerCase().includes(normalized),
    );
  }, [shops, shopFilter]);

  const filteredRecipes = useMemo(() => {
    const normalized = recipeFilter.trim().toLowerCase();
    if (!normalized) return recipes;
    return recipes.filter((recipe) =>
      [recipe.label, recipe.id, recipe.bench ?? ""].join(" ").toLowerCase().includes(normalized),
    );
  }, [recipes, recipeFilter]);

  if (loading) {
    return (
      <PageStack>
        <Panel className="panel-compact">
          <SkeletonText lines={6} />
        </Panel>
      </PageStack>
    );
  }

  if (!activeWorkspace) {
    return (
      <PageStack>
        <EmptyState
          title="Shop & Crafting Builders"
          description="Select an active workspace to manage shops and crafting recipes."
        />
      </PageStack>
    );
  }

  return (
    <PageStack>
      <PageIntro
        title="Shop & Crafting Builders"
        description={
          <>
            Author neutral shop inventories and crafting recipes under{" "}
            <code className="inline-code">.fdt/content/shops.json</code> and{" "}
            <code className="inline-code">.fdt/content/crafting-recipes.json</code>.
          </>
        }
        actions={
          <button type="button" onClick={() => void handleValidate()} className="btn btn-secondary btn-sm">
            Validate content
          </button>
        }
      />

      <Panel className="panel-compact">
        <div className="tab-row">
          {(["shops", "crafting"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`tab-btn capitalize ${tab === value ? "tab-btn-active" : ""}`}
            >
              {value}
            </button>
          ))}
        </div>
      </Panel>

      {tab === "shops" ? (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Panel className="panel-compact">
            <h3 className="panel-heading">Create Shop</h3>
            <form className="form-stack panel-section" onSubmit={handleSaveShop}>
              <label className="form-field">
                <span className="form-label">Shop id</span>
                <input required value={shopForm.id} onChange={(e) => setShopForm({ ...shopForm, id: e.target.value })} className="form-control" />
              </label>
              <label className="form-field">
                <span className="form-label">Label</span>
                <input required value={shopForm.label} onChange={(e) => setShopForm({ ...shopForm, label: e.target.value })} className="form-control" />
              </label>
              <label className="form-field">
                <span className="form-label">Starter item</span>
                <select value={shopForm.itemId} onChange={(e) => setShopForm({ ...shopForm, itemId: e.target.value })} className="form-control">
                  <option value="">None</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label} ({item.id})
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span className="form-label">Price</span>
                <input value={shopForm.itemPrice} onChange={(e) => setShopForm({ ...shopForm, itemPrice: e.target.value })} className="form-control" />
              </label>
              <button type="submit" className="btn btn-accent btn-sm">
                Save shop
              </button>
            </form>
          </Panel>

          <Panel className="panel-compact">
            <h3 className="panel-heading">Shops</h3>
            {shops.length === 0 ? (
              <p className="panel-subtext panel-section">No shops yet.</p>
            ) : (
              <div className="panel-section">
                <Toolbar
                  search={{ value: shopFilter, onChange: setShopFilter, placeholder: "Filter shops…", ariaLabel: "Filter shops" }}
                  count={`${filteredShops.length} of ${shops.length}`}
                />
                <DataTable columns={shopColumns} rows={filteredShops} getRowKey={(shop) => shop.id} emptyMessage="No shops match your filter." />
              </div>
            )}
          </Panel>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Panel className="panel-compact">
            <h3 className="panel-heading">Create Recipe</h3>
            <form className="form-stack panel-section" onSubmit={handleSaveRecipe}>
              <label className="form-field">
                <span className="form-label">Recipe id</span>
                <input required value={recipeForm.id} onChange={(e) => setRecipeForm({ ...recipeForm, id: e.target.value })} className="form-control" />
              </label>
              <label className="form-field">
                <span className="form-label">Label</span>
                <input required value={recipeForm.label} onChange={(e) => setRecipeForm({ ...recipeForm, label: e.target.value })} className="form-control" />
              </label>
              <label className="form-field">
                <span className="form-label">Input item</span>
                <select required value={recipeForm.inputItemId} onChange={(e) => setRecipeForm({ ...recipeForm, inputItemId: e.target.value })} className="form-control">
                  <option value="">Select…</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label} ({item.id})
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span className="form-label">Output item</span>
                <select required value={recipeForm.outputItemId} onChange={(e) => setRecipeForm({ ...recipeForm, outputItemId: e.target.value })} className="form-control">
                  <option value="">Select…</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label} ({item.id})
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="btn btn-accent btn-sm">
                Save recipe
              </button>
            </form>
          </Panel>

          <Panel className="panel-compact">
            <h3 className="panel-heading">Recipes</h3>
            {recipes.length === 0 ? (
              <p className="panel-subtext panel-section">No crafting recipes yet.</p>
            ) : (
              <div className="panel-section">
                <Toolbar
                  search={{ value: recipeFilter, onChange: setRecipeFilter, placeholder: "Filter recipes…", ariaLabel: "Filter recipes" }}
                  count={`${filteredRecipes.length} of ${recipes.length}`}
                />
                <DataTable columns={recipeColumns} rows={filteredRecipes} getRowKey={(recipe) => recipe.id} emptyMessage="No recipes match your filter." />
              </div>
            )}
          </Panel>
        </div>
      )}
    </PageStack>
  );
}
