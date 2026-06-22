import { useEffect, useState } from "react";
import {
  EmptyState,
  PageAlert,
  PageIntro,
  PageStack,
  Panel,
} from "../components/ui/page";
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
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceWithConfig | null>(null);
  const [tab, setTab] = useState<"shops" | "crafting">("shops");
  const [items, setItems] = useState<ItemOption[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [recipes, setRecipes] = useState<CraftingRecipe[]>([]);
  const [shopForm, setShopForm] = useState(EMPTY_SHOP);
  const [recipeForm, setRecipeForm] = useState(EMPTY_RECIPE);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    setMessage(null);

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
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleValidate() {
    setMessage(null);
    const response = await fetch("/api/v1/content/validate", { method: "POST" });
    const payload = (await response.json()) as {
      message?: string;
      report?: { summary: { errors: number; warnings: number; shopsChecked: number; recipesChecked: number } };
    };
    if (!response.ok) {
      setMessage(payload.message ?? "Validation failed");
      return;
    }
    const summary = payload.report?.summary;
    setMessage(
      summary
        ? `Validation complete: ${summary.errors} errors, ${summary.warnings} warnings (${summary.shopsChecked} shops, ${summary.recipesChecked} recipes)`
        : "Validation complete",
    );
  }

  async function handleSaveShop(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

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
      setMessage(payload.message ?? "Failed to save shop");
      return;
    }

    setShopForm(EMPTY_SHOP);
    setMessage(`Saved shop ${shopForm.id.trim()}`);
    await loadData();
  }

  async function handleSaveRecipe(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    const response = await fetch("/api/v1/content/crafting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: recipeForm.id.trim(),
        label: recipeForm.label.trim(),
        bench: recipeForm.bench.trim() || undefined,
        inputs: [
          {
            itemId: recipeForm.inputItemId.trim(),
            amount: Number(recipeForm.inputAmount) || 1,
          },
        ],
        outputs: [
          {
            itemId: recipeForm.outputItemId.trim(),
            amount: Number(recipeForm.outputAmount) || 1,
          },
        ],
        metadata: {},
      }),
    });

    const payload = (await response.json()) as { message?: string };
    if (!response.ok) {
      setMessage(payload.message ?? "Failed to save recipe");
      return;
    }

    setRecipeForm(EMPTY_RECIPE);
    setMessage(`Saved recipe ${recipeForm.id.trim()}`);
    await loadData();
  }

  if (loading) {
    return (
      <PageStack>
        <p className="panel-subtext">Loading commerce builders…</p>
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
            <code className="inline-code">.fdt/content/crafting-recipes.json</code>. Validation checks missing item
            references via <code className="inline-code">fdt content validate</code>.
          </>
        }
        actions={
          <button type="button" onClick={() => void handleValidate()} className="btn btn-secondary btn-sm">
            Validate content
          </button>
        }
      />

      {message && <PageAlert>{message}</PageAlert>}

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
                <input
                  required
                  value={shopForm.id}
                  onChange={(e) => setShopForm({ ...shopForm, id: e.target.value })}
                  className="form-control"
                />
              </label>
              <label className="form-field">
                <span className="form-label">Label</span>
                <input
                  required
                  value={shopForm.label}
                  onChange={(e) => setShopForm({ ...shopForm, label: e.target.value })}
                  className="form-control"
                />
              </label>
              <label className="form-field">
                <span className="form-label">Starter item</span>
                <select
                  value={shopForm.itemId}
                  onChange={(e) => setShopForm({ ...shopForm, itemId: e.target.value })}
                  className="form-control"
                >
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
                <input
                  value={shopForm.itemPrice}
                  onChange={(e) => setShopForm({ ...shopForm, itemPrice: e.target.value })}
                  className="form-control"
                />
              </label>
              <button type="submit" className="btn btn-accent btn-sm">
                Save shop
              </button>
            </form>
          </Panel>

          <Panel className="panel-compact">
            <h3 className="panel-heading">Shops ({shops.length})</h3>
            <div className="panel-section space-y-3">
              {shops.length === 0 ? (
                <p className="panel-subtext">No shops yet.</p>
              ) : (
                shops.map((shop) => (
                  <article key={shop.id} className="finding-card text-sm">
                    <div className="font-medium">{shop.label}</div>
                    <div className="text-xs text-[var(--color-muted)]">
                      {shop.id} · {shop.type} · {shop.currency}
                    </div>
                    <ul className="list-plain mt-2 text-[var(--color-muted)]">
                      {shop.items.map((entry) => (
                        <li key={`${shop.id}-${entry.itemId}`}>
                          {entry.itemId} — ${entry.price}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))
              )}
            </div>
          </Panel>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Panel className="panel-compact">
            <h3 className="panel-heading">Create Recipe</h3>
            <form className="form-stack panel-section" onSubmit={handleSaveRecipe}>
              <label className="form-field">
                <span className="form-label">Recipe id</span>
                <input
                  required
                  value={recipeForm.id}
                  onChange={(e) => setRecipeForm({ ...recipeForm, id: e.target.value })}
                  className="form-control"
                />
              </label>
              <label className="form-field">
                <span className="form-label">Label</span>
                <input
                  required
                  value={recipeForm.label}
                  onChange={(e) => setRecipeForm({ ...recipeForm, label: e.target.value })}
                  className="form-control"
                />
              </label>
              <label className="form-field">
                <span className="form-label">Input item</span>
                <select
                  required
                  value={recipeForm.inputItemId}
                  onChange={(e) => setRecipeForm({ ...recipeForm, inputItemId: e.target.value })}
                  className="form-control"
                >
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
                <select
                  required
                  value={recipeForm.outputItemId}
                  onChange={(e) => setRecipeForm({ ...recipeForm, outputItemId: e.target.value })}
                  className="form-control"
                >
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
            <h3 className="panel-heading">Recipes ({recipes.length})</h3>
            <div className="panel-section space-y-3">
              {recipes.length === 0 ? (
                <p className="panel-subtext">No crafting recipes yet.</p>
              ) : (
                recipes.map((recipe) => (
                  <article key={recipe.id} className="finding-card text-sm">
                    <div className="font-medium">{recipe.label}</div>
                    <div className="text-xs text-[var(--color-muted)]">{recipe.id}</div>
                    <p className="mt-2 text-[var(--color-muted)]">
                      {recipe.inputs.map((input) => `${input.amount}x ${input.itemId}`).join(" + ")} →{" "}
                      {recipe.outputs.map((output) => `${output.amount}x ${output.itemId}`).join(", ")}
                    </p>
                  </article>
                ))
              )}
            </div>
          </Panel>
        </div>
      )}
    </PageStack>
  );
}
