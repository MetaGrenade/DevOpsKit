import { useEffect, useState } from "react";
import type { WorkspaceWithConfig } from "../types/api";

interface Item {
  id: string;
  label: string;
  description?: string;
  category: string;
  icon?: string;
  weight: number;
  stackable: boolean;
  unique: boolean;
  usable: boolean;
}

interface AdapterInfo {
  id: string;
  label: string;
  version: string;
  capabilities: string[];
  recommended?: boolean;
}

interface FrameworkProfileSummary {
  framework: string;
  inventory: string;
  recommendedAdapters: string[];
  source: string;
}

interface ExportFile {
  relativePath: string;
  content: string;
}

const EMPTY_FORM = {
  id: "",
  label: "",
  description: "",
  category: "misc",
  icon: "",
  weight: "0",
  stackable: true,
  unique: false,
  usable: false,
};

export default function ItemsPage() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceWithConfig | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [adapters, setAdapters] = useState<AdapterInfo[]>([]);
  const [selectedAdapter, setSelectedAdapter] = useState("custom-json");
  const [frameworkProfile, setFrameworkProfile] = useState<FrameworkProfileSummary | null>(null);
  const [exportPreview, setExportPreview] = useState<ExportFile[] | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
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
        return;
      }
      if (!wsRes.ok) throw new Error("Failed to load active workspace");
      setActiveWorkspace((await wsRes.json()) as WorkspaceWithConfig);

      const [itemsRes, adaptersRes] = await Promise.all([
        fetch("/api/v1/content/items"),
        fetch("/api/v1/content/adapters"),
      ]);

      if (itemsRes.ok) {
        const data = (await itemsRes.json()) as { items: Item[] };
        setItems(data.items);
      }

      if (adaptersRes.ok) {
        const data = (await adaptersRes.json()) as {
          adapters: AdapterInfo[];
          recommendedAdapter?: string;
          frameworkProfile?: FrameworkProfileSummary | null;
        };
        setAdapters(data.adapters);
        setFrameworkProfile(data.frameworkProfile ?? null);
        if (data.recommendedAdapter) {
          setSelectedAdapter(data.recommendedAdapter);
        }
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

  async function handleSaveItem(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    const payload = {
      id: form.id.trim(),
      label: form.label.trim(),
      description: form.description.trim() || undefined,
      category: form.category,
      icon: form.icon.trim() || undefined,
      weight: Number(form.weight) || 0,
      stackable: form.stackable,
      unique: form.unique,
      usable: form.usable,
      metadata: {},
    };

    const response = await fetch("/api/v1/content/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = (await response.json()) as { message?: string };
      setMessage(body.message ?? "Failed to save item");
      return;
    }

    setForm(EMPTY_FORM);
    await loadData();
    setMessage(`Saved item "${payload.id}"`);
  }

  async function handleDeleteItem(itemId: string) {
    const response = await fetch(`/api/v1/content/items/${itemId}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage(`Failed to delete ${itemId}`);
      return;
    }
    await loadData();
  }

  async function handleValidate() {
    const response = await fetch("/api/v1/content/validate", { method: "POST" });
    if (!response.ok) {
      setMessage("Validation failed");
      return;
    }
    const data = (await response.json()) as {
      report: { summary: { errors: number; warnings: number; itemsChecked: number } };
    };
    setMessage(
      `Validated ${data.report.summary.itemsChecked} items — ${data.report.summary.errors} errors, ${data.report.summary.warnings} warnings`,
    );
  }

  async function handleExportPreview() {
    const response = await fetch("/api/v1/content/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adapter: selectedAdapter, dryRun: true }),
    });

    if (!response.ok) {
      setMessage("Export preview failed");
      return;
    }

    const data = (await response.json()) as { files: ExportFile[] };
    setExportPreview(data.files);
  }

  if (loading) {
    return <p className="text-slate-400">Loading items…</p>;
  }

  if (!activeWorkspace) {
    return (
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <h2 className="text-xl font-semibold">Item Workbench</h2>
        <p className="mt-2 text-sm text-slate-400">Select or register a workspace first.</p>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Item Workbench</h2>
            <p className="mt-1 text-sm text-slate-400">
              Neutral item registry for <span className="text-cyan-200">{activeWorkspace.name}</span>
              {frameworkProfile && (
                <>
                  {" "}
                  ·{" "}
                  <span className="text-slate-300">
                    {frameworkProfile.framework} / {frameworkProfile.inventory}
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleValidate()}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5"
            >
              Validate
            </button>
          </div>
        </div>

        {message && (
          <p className="mt-4 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
            {message}
          </p>
        )}

        <form onSubmit={(e) => void handleSaveItem(e)} className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-400">Item ID</span>
            <input
              required
              pattern="[a-z0-9_]+"
              value={form.id}
              onChange={(e) => setForm({ ...form, id: e.target.value })}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
              placeholder="water_bottle"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">Label</span>
            <input
              required
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
              placeholder="Water Bottle"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-slate-400">Description</span>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">Category</span>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
            >
              {["food", "drink", "medical", "tool", "weapon", "material", "misc"].map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">Weight (kg)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.weight}
              onChange={(e) => setForm({ ...form, weight: e.target.value })}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
            />
          </label>
          <div className="flex flex-wrap gap-4 text-sm sm:col-span-2">
            {(["stackable", "unique", "usable"] as const).map((key) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                />
                {key}
              </label>
            ))}
          </div>
          <button
            type="submit"
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium hover:bg-cyan-500 sm:col-span-2"
          >
            Save item
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <h3 className="font-semibold">Registry ({items.length})</h3>
        {items.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No items yet. Add one above or import via CLI.</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/5">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-cyan-100">{item.label}</p>
                  <p className="text-xs text-slate-500">
                    {item.id} · {item.category} · {item.weight}kg
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDeleteItem(item.id)}
                  className="text-xs text-rose-300 hover:text-rose-200"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <h3 className="font-semibold">Adapter export preview</h3>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select
            value={selectedAdapter}
            onChange={(e) => setSelectedAdapter(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2 text-sm"
          >
            {adapters.map((adapter) => (
              <option key={adapter.id} value={adapter.id}>
                {adapter.label}
                {adapter.recommended ? " (recommended)" : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void handleExportPreview()}
            className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
          >
            Preview export
          </button>
        </div>

        {exportPreview && (
          <div className="mt-4 space-y-4">
            {exportPreview.map((file) => (
              <div key={file.relativePath}>
                <p className="text-xs uppercase tracking-wide text-slate-500">{file.relativePath}</p>
                <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-[#0b1020] p-4 text-xs text-slate-300">
                  {file.content}
                </pre>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
