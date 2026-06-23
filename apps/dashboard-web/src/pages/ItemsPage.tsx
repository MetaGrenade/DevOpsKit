import { useEffect, useMemo, useState } from "react";
import {
  EmptyState,
  PageIntro,
  PageStack,
  Panel,
  ZeroDataPanel,
} from "../components/ui/page";
import { SkeletonText } from "../components/ui/primitives";
import DataTable, { type DataTableColumn } from "../components/ui/DataTable";
import Toolbar from "../components/ui/Toolbar";
import { useToast } from "../components/ui/Toast";
import { useTableFilter } from "../hooks/useTableFilter";
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
  const { notify } = useToast();
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceWithConfig | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [adapters, setAdapters] = useState<AdapterInfo[]>([]);
  const [selectedAdapter, setSelectedAdapter] = useState("custom-json");
  const [frameworkProfile, setFrameworkProfile] = useState<FrameworkProfileSummary | null>(null);
  const [exportPreview, setExportPreview] = useState<ExportFile[] | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const {
    query: itemFilter,
    setQuery: setItemFilter,
    views: itemViews,
    saveView: saveItemView,
    applyView: applyItemView,
    deleteView: deleteItemView,
  } = useTableFilter("items");
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);

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
      notify({
        title: "Failed to load items",
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

  async function handleSaveItem(event: React.FormEvent) {
    event.preventDefault();

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
      notify({ title: "Failed to save item", message: body.message ?? undefined, tone: "error" });
      return;
    }

    setForm(EMPTY_FORM);
    await loadData();
    notify({ title: `Saved item "${payload.id}"`, tone: "success" });
  }

  async function handleDeleteItem(itemId: string) {
    const response = await fetch(`/api/v1/content/items/${itemId}`, { method: "DELETE" });
    if (!response.ok) {
      notify({ title: `Failed to delete ${itemId}`, tone: "error" });
      return;
    }
    notify({ title: `Removed item ${itemId}`, tone: "success" });
    await loadData();
  }

  async function handleValidate() {
    const response = await fetch("/api/v1/content/validate", { method: "POST" });
    if (!response.ok) {
      notify({ title: "Validation failed", tone: "error" });
      return;
    }
    const data = (await response.json()) as {
      report: { summary: { errors: number; warnings: number; itemsChecked: number } };
    };
    notify({
      title: "Validation complete",
      message: `${data.report.summary.itemsChecked} items · ${data.report.summary.errors} errors · ${data.report.summary.warnings} warnings`,
      tone: data.report.summary.errors > 0 ? "warning" : "success",
    });
  }

  async function handleExportPreview() {
    const response = await fetch("/api/v1/content/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adapter: selectedAdapter, dryRun: true }),
    });

    if (!response.ok) {
      notify({ title: "Export preview failed", tone: "error" });
      return;
    }

    const data = (await response.json()) as { files: ExportFile[] };
    setExportPreview(data.files);
  }

  const itemColumns: Array<DataTableColumn<Item>> = useMemo(
    () => [
      {
        key: "label",
        header: "Item",
        render: (item) => (
          <div>
            <p className="font-medium text-[var(--color-accent-ink)]">{item.label}</p>
            <p className="text-xs text-[var(--color-muted)]">{item.id}</p>
          </div>
        ),
      },
      { key: "category", header: "Category", render: (item) => item.category },
      { key: "weight", header: "Weight", align: "right", render: (item) => `${item.weight}kg` },
      {
        key: "actions",
        header: "",
        align: "right",
        render: (item) => (
          <button
            type="button"
            onClick={() => void handleDeleteItem(item.id)}
            className="btn btn-secondary btn-sm"
          >
            Delete
          </button>
        ),
      },
    ],
    [],
  );

  const filteredItems = useMemo(() => {
    const normalized = itemFilter.trim().toLowerCase();
    if (!normalized) {
      return items;
    }
    return items.filter((item) =>
      [item.label, item.id, item.category].join(" ").toLowerCase().includes(normalized),
    );
  }, [items, itemFilter]);

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
          title="Item Workbench"
          description="Select or register a workspace first."
          variant="workspace"
        />
      </PageStack>
    );
  }

  return (
    <PageStack>
      <PageIntro
        title="Item Workbench"
        description={
          <>
            Neutral item registry for{" "}
            <span className="text-[var(--color-accent-ink)]">{activeWorkspace.name}</span>
            {frameworkProfile && (
              <>
                {" "}
                · {frameworkProfile.framework} / {frameworkProfile.inventory}
              </>
            )}
          </>
        }
        actions={
          <button type="button" onClick={() => void handleValidate()} className="btn btn-secondary btn-sm">
            Validate
          </button>
        }
      />

      <Panel className="panel-compact">
        <form onSubmit={(e) => void handleSaveItem(e)} className="form-grid form-grid-2 form-stack">
          <label className="form-field">
            <span className="form-label">Item ID</span>
            <input
              required
              pattern="[a-z0-9_]+"
              value={form.id}
              onChange={(e) => setForm({ ...form, id: e.target.value })}
              className="form-control"
              placeholder="water_bottle"
            />
          </label>
          <label className="form-field">
            <span className="form-label">Label</span>
            <input
              required
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="form-control"
              placeholder="Water Bottle"
            />
          </label>
          <label className="form-field sm:col-span-2">
            <span className="form-label">Description</span>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="form-control"
            />
          </label>
          <label className="form-field">
            <span className="form-label">Category</span>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="form-control"
            >
              {["food", "drink", "medical", "tool", "weapon", "material", "misc"].map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span className="form-label">Weight (kg)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.weight}
              onChange={(e) => setForm({ ...form, weight: e.target.value })}
              className="form-control"
            />
          </label>
          <div className="flex flex-wrap gap-4 sm:col-span-2">
            {(["stackable", "unique", "usable"] as const).map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                />
                {key}
              </label>
            ))}
          </div>
          <button type="submit" className="btn btn-accent btn-sm sm:col-span-2">
            Save item
          </button>
        </form>
      </Panel>

      <Panel className="panel-compact">
        <h3 className="panel-heading">Registry</h3>
        {items.length === 0 ? (
          <ZeroDataPanel
            title="No items yet"
            description="Add one above or import via CLI."
            variant="content"
          />
        ) : (
          <div className="panel-section">
            <Toolbar
              search={{
                value: itemFilter,
                onChange: setItemFilter,
                placeholder: "Filter items…",
                ariaLabel: "Filter item registry",
              }}
              views={{
                items: itemViews,
                onApply: applyItemView,
                onSave: saveItemView,
                onDelete: deleteItemView,
              }}
              count={`${filteredItems.length} of ${items.length}`}
            />
            <DataTable
              columns={itemColumns}
              rows={filteredItems}
              getRowKey={(item) => item.id}
              emptyMessage="No items match your filter."
            />
          </div>
        )}
      </Panel>

      <Panel className="panel-compact">
        <h3 className="panel-heading">Adapter export preview</h3>
        <div className="btn-row panel-section">
          <select
            value={selectedAdapter}
            onChange={(e) => setSelectedAdapter(e.target.value)}
            className="form-control"
          >
            {adapters.map((adapter) => (
              <option key={adapter.id} value={adapter.id}>
                {adapter.label}
                {adapter.recommended ? " (recommended)" : ""}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void handleExportPreview()} className="btn btn-secondary btn-sm">
            Preview export
          </button>
        </div>

        {exportPreview && (
          <div className="panel-section space-y-4">
            {exportPreview.map((file) => (
              <div key={file.relativePath}>
                <p className="stat-tile-label">{file.relativePath}</p>
                <pre className="code-block mt-2 max-h-64 overflow-auto">{file.content}</pre>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </PageStack>
  );
}
