import { useEffect, useState } from "react";
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
    return <p className="text-sm text-slate-400">Loading commerce builders…</p>;
  }

  if (!activeWorkspace) {
    return (
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <h2 className="text-xl font-semibold">Shop & Crafting Builders</h2>
        <p className="mt-2 text-sm text-slate-400">Select an active workspace to manage shops and crafting recipes.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Shop & Crafting Builders</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Author neutral shop inventories and crafting recipes under{" "}
              <code className="rounded bg-white/5 px-1.5 py-0.5">.fdt/content/shops.json</code> and{" "}
              <code className="rounded bg-white/5 px-1.5 py-0.5">.fdt/content/crafting-recipes.json</code>.
              Validation checks missing item references via{" "}
              <code className="rounded bg-white/5 px-1.5 py-0.5">fdt content validate</code>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleValidate()}
            className="rounded-lg bg-cyan-500/15 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/25"
          >
            Validate content
          </button>
        </div>

        {message && (
          <p className="mt-4 rounded-lg border border-white/10 bg-[#0b1020] px-4 py-2 text-sm text-slate-200">
            {message}
          </p>
        )}

        <div className="mt-6 flex gap-2 text-sm">
          {(["shops", "crafting"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`rounded-lg px-3 py-1.5 capitalize ${
                tab === value ? "bg-cyan-500/20 text-cyan-200" : "text-slate-400 hover:text-white"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </section>

      {tab === "shops" ? (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
            <h3 className="font-semibold">Create Shop</h3>
            <form className="mt-4 space-y-3 text-sm" onSubmit={handleSaveShop}>
              <label className="block">
                <span className="text-slate-400">Shop id</span>
                <input
                  required
                  value={shopForm.id}
                  onChange={(e) => setShopForm({ ...shopForm, id: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="text-slate-400">Label</span>
                <input
                  required
                  value={shopForm.label}
                  onChange={(e) => setShopForm({ ...shopForm, label: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="text-slate-400">Starter item</span>
                <select
                  value={shopForm.itemId}
                  onChange={(e) => setShopForm({ ...shopForm, itemId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
                >
                  <option value="">None</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label} ({item.id})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-slate-400">Price</span>
                <input
                  value={shopForm.itemPrice}
                  onChange={(e) => setShopForm({ ...shopForm, itemPrice: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
                />
              </label>
              <button
                type="submit"
                className="rounded-lg bg-cyan-500/20 px-4 py-2 font-medium text-cyan-200 hover:bg-cyan-500/30"
              >
                Save shop
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
            <h3 className="font-semibold">Shops ({shops.length})</h3>
            <div className="mt-4 space-y-3">
              {shops.length === 0 ? (
                <p className="text-sm text-slate-400">No shops yet.</p>
              ) : (
                shops.map((shop) => (
                  <article key={shop.id} className="rounded-lg border border-white/10 bg-[#0b1020] p-4 text-sm">
                    <div className="font-medium text-cyan-200">{shop.label}</div>
                    <div className="text-xs text-slate-500">
                      {shop.id} · {shop.type} · {shop.currency}
                    </div>
                    <ul className="mt-2 space-y-1 text-slate-400">
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
          </section>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
            <h3 className="font-semibold">Create Recipe</h3>
            <form className="mt-4 space-y-3 text-sm" onSubmit={handleSaveRecipe}>
              <label className="block">
                <span className="text-slate-400">Recipe id</span>
                <input
                  required
                  value={recipeForm.id}
                  onChange={(e) => setRecipeForm({ ...recipeForm, id: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="text-slate-400">Label</span>
                <input
                  required
                  value={recipeForm.label}
                  onChange={(e) => setRecipeForm({ ...recipeForm, label: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="text-slate-400">Input item</span>
                <select
                  required
                  value={recipeForm.inputItemId}
                  onChange={(e) => setRecipeForm({ ...recipeForm, inputItemId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
                >
                  <option value="">Select…</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label} ({item.id})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-slate-400">Output item</span>
                <select
                  required
                  value={recipeForm.outputItemId}
                  onChange={(e) => setRecipeForm({ ...recipeForm, outputItemId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
                >
                  <option value="">Select…</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label} ({item.id})
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="rounded-lg bg-cyan-500/20 px-4 py-2 font-medium text-cyan-200 hover:bg-cyan-500/30"
              >
                Save recipe
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
            <h3 className="font-semibold">Recipes ({recipes.length})</h3>
            <div className="mt-4 space-y-3">
              {recipes.length === 0 ? (
                <p className="text-sm text-slate-400">No crafting recipes yet.</p>
              ) : (
                recipes.map((recipe) => (
                  <article key={recipe.id} className="rounded-lg border border-white/10 bg-[#0b1020] p-4 text-sm">
                    <div className="font-medium text-cyan-200">{recipe.label}</div>
                    <div className="text-xs text-slate-500">{recipe.id}</div>
                    <p className="mt-2 text-slate-400">
                      {recipe.inputs.map((input) => `${input.amount}x ${input.itemId}`).join(" + ")} →{" "}
                      {recipe.outputs.map((output) => `${output.amount}x ${output.itemId}`).join(", ")}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
