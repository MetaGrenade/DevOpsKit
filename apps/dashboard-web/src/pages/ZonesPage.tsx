import { useEffect, useState } from "react";
import {
  EmptyState,
  NotePanel,
  PageAlert,
  PageIntro,
  PageStack,
  Panel,
} from "../components/ui/page";
import type { WorkspaceWithConfig } from "../types/api";

interface ZoneCoord {
  x: number;
  y: number;
  z: number;
}

interface Zone {
  id: string;
  label: string;
  type: "sphere" | "box" | "poly";
  purpose: string;
  coords: ZoneCoord[];
  heading?: number;
  radius?: number;
  width?: number;
  length?: number;
  minZ?: number;
  maxZ?: number;
  metadata: Record<string, unknown>;
}

const EMPTY_FORM = {
  id: "",
  label: "",
  type: "sphere" as Zone["type"],
  purpose: "custom",
  x: "0",
  y: "0",
  z: "0",
  heading: "",
  radius: "2",
  width: "4",
  length: "4",
};

export default function ZonesPage() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceWithConfig | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [importJson, setImportJson] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    setMessage(null);

    try {
      const wsRes = await fetch("/api/v1/workspaces/active");
      if (wsRes.status === 404) {
        setActiveWorkspace(null);
        setZones([]);
        return;
      }
      if (!wsRes.ok) throw new Error("Failed to load active workspace");
      setActiveWorkspace((await wsRes.json()) as WorkspaceWithConfig);

      const zonesRes = await fetch("/api/v1/zones");
      if (zonesRes.ok) {
        const data = (await zonesRes.json()) as { zones: Zone[] };
        setZones(data.zones);
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

  async function handleSaveZone(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    const payload: Zone = {
      id: form.id.trim(),
      label: form.label.trim(),
      type: form.type,
      purpose: form.purpose,
      coords: [{ x: Number(form.x), y: Number(form.y), z: Number(form.z) }],
      metadata: {},
    };

    if (form.heading.trim()) payload.heading = Number(form.heading);
    if (form.type === "sphere") payload.radius = Number(form.radius) || 2;
    if (form.type === "box") {
      payload.width = Number(form.width) || 4;
      payload.length = Number(form.length) || 4;
    }

    const response = await fetch("/api/v1/zones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = (await response.json()) as { message?: string };
      setMessage(error.message ?? "Failed to save zone");
      return;
    }

    setForm(EMPTY_FORM);
    setMessage("Zone saved.");
    await loadData();
  }

  async function handleDeleteZone(zoneId: string) {
    setMessage(null);
    const response = await fetch(`/api/v1/zones/${encodeURIComponent(zoneId)}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setMessage(`Failed to delete zone: ${zoneId}`);
      return;
    }

    setMessage(`Removed zone: ${zoneId}`);
    await loadData();
  }

  async function handleImport(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    try {
      const payload = JSON.parse(importJson) as unknown;
      const response = await fetch("/api/v1/zones/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = (await response.json()) as { message?: string };
        setMessage(error.message ?? "Import failed");
        return;
      }

      const result = (await response.json()) as { imported: number };
      setImportJson("");
      setMessage(`Imported ${result.imported} zone(s) from devtools export.`);
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invalid JSON");
    }
  }

  if (loading) {
    return (
      <PageStack>
        <p className="panel-subtext">Loading zones…</p>
      </PageStack>
    );
  }

  if (!activeWorkspace) {
    return (
      <PageStack>
        <EmptyState title="Zones" description="Select an active workspace to manage zones." />
      </PageStack>
    );
  }

  return (
    <PageStack>
      <PageIntro
        title="Zone Registry"
        description={
          <>
            Neutral zone records stored at <code className="inline-code">.fdt/zones/zones.json</code>. Create zones
            in-game with the <code className="inline-code">fdt_devtools</code> resource and import the exported JSON
            here, or add zones manually.
          </>
        }
      />

      <NotePanel title="In-game setup">
        <ol>
          <li>
            Copy <code className="inline-code">resources/fdt_devtools</code> into your server resources folder.
          </li>
          <li>
            Grant ACE permission: <code className="inline-code">add_ace group.admin fdt.devtools allow</code>
          </li>
          <li>
            Set <code className="inline-code">Config.PostToDashboard = true</code> and{" "}
            <code className="inline-code">Config.DashboardImportUrl</code> to{" "}
            <code className="inline-code">http://127.0.0.1:3001/api/v1/zones/import</code>
          </li>
          <li>
            Use <code className="inline-code">/fdt</code> in-game to open the overlay.
          </li>
        </ol>
      </NotePanel>

      {message && <PageAlert>{message}</PageAlert>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="panel-compact">
          <h3 className="panel-heading">Add / Update Zone</h3>
          <form className="form-stack panel-section" onSubmit={handleSaveZone}>
            <div className="form-grid form-grid-2">
              <label className="form-field">
                <span className="form-label">ID</span>
                <input
                  required
                  value={form.id}
                  onChange={(e) => setForm({ ...form, id: e.target.value })}
                  className="form-control"
                  placeholder="shop_downtown"
                />
              </label>
              <label className="form-field">
                <span className="form-label">Label</span>
                <input
                  required
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  className="form-control"
                />
              </label>
            </div>

            <div className="form-grid form-grid-2">
              <label className="form-field">
                <span className="form-label">Type</span>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as Zone["type"] })}
                  className="form-control"
                >
                  <option value="sphere">sphere</option>
                  <option value="box">box</option>
                  <option value="poly">poly</option>
                </select>
              </label>
              <label className="form-field">
                <span className="form-label">Purpose</span>
                <select
                  value={form.purpose}
                  onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                  className="form-control"
                >
                  {["shop", "stash", "garage", "interaction", "territory", "job", "event", "custom"].map(
                    (purpose) => (
                      <option key={purpose} value={purpose}>
                        {purpose}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>

            <div className="form-grid form-grid-3">
              {(["x", "y", "z"] as const).map((axis) => (
                <label key={axis} className="form-field">
                  <span className="form-label uppercase">{axis}</span>
                  <input
                    required
                    value={form[axis]}
                    onChange={(e) => setForm({ ...form, [axis]: e.target.value })}
                    className="form-control"
                  />
                </label>
              ))}
            </div>

            {form.type === "sphere" && (
              <label className="form-field">
                <span className="form-label">Radius</span>
                <input
                  value={form.radius}
                  onChange={(e) => setForm({ ...form, radius: e.target.value })}
                  className="form-control"
                />
              </label>
            )}

            {form.type === "box" && (
              <div className="form-grid form-grid-3">
                <label className="form-field">
                  <span className="form-label">Width</span>
                  <input
                    value={form.width}
                    onChange={(e) => setForm({ ...form, width: e.target.value })}
                    className="form-control"
                  />
                </label>
                <label className="form-field">
                  <span className="form-label">Length</span>
                  <input
                    value={form.length}
                    onChange={(e) => setForm({ ...form, length: e.target.value })}
                    className="form-control"
                  />
                </label>
                <label className="form-field">
                  <span className="form-label">Heading</span>
                  <input
                    value={form.heading}
                    onChange={(e) => setForm({ ...form, heading: e.target.value })}
                    className="form-control"
                  />
                </label>
              </div>
            )}

            <button type="submit" className="btn btn-accent btn-sm">
              Save zone
            </button>
          </form>
        </Panel>

        <Panel className="panel-compact">
          <h3 className="panel-heading">Import from DevTools</h3>
          <p className="panel-subtext">
            Paste JSON exported from <code className="inline-code">/fdt</code> or saved export files.
          </p>
          <form className="form-stack panel-section" onSubmit={handleImport}>
            <textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              rows={10}
              placeholder='{"schemaVersion":1,"resource":"fdt_devtools","zones":[...]}'
              className="form-control font-mono text-xs"
            />
            <button type="submit" className="btn btn-secondary btn-sm">
              Import JSON
            </button>
          </form>
        </Panel>
      </div>

      <Panel className="panel-compact">
        <h3 className="panel-heading">Registered Zones ({zones.length})</h3>
        {zones.length === 0 ? (
          <p className="panel-subtext panel-section">No zones yet.</p>
        ) : (
          <div className="panel-section data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Label</th>
                  <th>Type</th>
                  <th>Purpose</th>
                  <th>Coords</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((zone) => (
                  <tr key={zone.id}>
                    <td className="font-mono text-xs text-[var(--color-accent-ink)]">{zone.id}</td>
                    <td>{zone.label}</td>
                    <td>{zone.type}</td>
                    <td>{zone.purpose}</td>
                    <td className="font-mono text-xs text-[var(--color-muted)]">
                      {zone.coords
                        .map((coord) => `${coord.x.toFixed(2)}, ${coord.y.toFixed(2)}, ${coord.z.toFixed(2)}`)
                        .join(" · ")}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => void handleDeleteZone(zone.id)}
                        className="btn btn-secondary btn-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </PageStack>
  );
}
