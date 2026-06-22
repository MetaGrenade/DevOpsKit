import { useEffect, useState } from "react";
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
    return <p className="text-sm text-slate-400">Loading zones…</p>;
  }

  if (!activeWorkspace) {
    return (
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <h2 className="text-xl font-semibold">Zones</h2>
        <p className="mt-2 text-sm text-slate-400">Select an active workspace to manage zones.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <h2 className="text-xl font-semibold">Zone Registry</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          Neutral zone records stored at{" "}
          <code className="rounded bg-white/5 px-1.5 py-0.5">.fdt/zones/zones.json</code>. Create
          zones in-game with the{" "}
          <code className="rounded bg-white/5 px-1.5 py-0.5">fdt_devtools</code> resource and import
          the exported JSON here, or add zones manually.
        </p>

        <div className="mt-4 rounded-xl border border-dashed border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-slate-300">
          <p className="font-medium text-cyan-200">In-game setup</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-400">
            <li>
              Copy <code className="text-slate-200">resources/fdt_devtools</code> into your server
              resources folder.
            </li>
            <li>
              Grant ACE permission:{" "}
              <code className="text-slate-200">add_ace group.admin fdt.devtools allow</code>
            </li>
            <li>
              Set <code className="text-slate-200">Config.PostToDashboard = true</code> and{" "}
              <code className="text-slate-200">Config.DashboardImportUrl</code> to{" "}
              <code className="text-slate-200">http://127.0.0.1:3001/api/v1/zones/import</code>
            </li>
            <li>Use <code className="text-slate-200">/fdt</code> in-game to open the overlay.</li>
          </ol>
        </div>

        {message && (
          <p className="mt-4 rounded-lg border border-white/10 bg-[#0b1020] px-4 py-2 text-sm text-slate-200">
            {message}
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
          <h3 className="font-semibold">Add / Update Zone</h3>
          <form className="mt-4 space-y-3 text-sm" onSubmit={handleSaveZone}>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-slate-400">ID</span>
                <input
                  required
                  value={form.id}
                  onChange={(e) => setForm({ ...form, id: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
                  placeholder="shop_downtown"
                />
              </label>
              <label className="block">
                <span className="text-slate-400">Label</span>
                <input
                  required
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-slate-400">Type</span>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as Zone["type"] })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
                >
                  <option value="sphere">sphere</option>
                  <option value="box">box</option>
                  <option value="poly">poly</option>
                </select>
              </label>
              <label className="block">
                <span className="text-slate-400">Purpose</span>
                <select
                  value={form.purpose}
                  onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
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

            <div className="grid grid-cols-3 gap-3">
              {(["x", "y", "z"] as const).map((axis) => (
                <label key={axis} className="block">
                  <span className="text-slate-400 uppercase">{axis}</span>
                  <input
                    required
                    value={form[axis]}
                    onChange={(e) => setForm({ ...form, [axis]: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
                  />
                </label>
              ))}
            </div>

            {form.type === "sphere" && (
              <label className="block">
                <span className="text-slate-400">Radius</span>
                <input
                  value={form.radius}
                  onChange={(e) => setForm({ ...form, radius: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
                />
              </label>
            )}

            {form.type === "box" && (
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-slate-400">Width</span>
                  <input
                    value={form.width}
                    onChange={(e) => setForm({ ...form, width: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
                  />
                </label>
                <label className="block">
                  <span className="text-slate-400">Length</span>
                  <input
                    value={form.length}
                    onChange={(e) => setForm({ ...form, length: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
                  />
                </label>
                <label className="block">
                  <span className="text-slate-400">Heading</span>
                  <input
                    value={form.heading}
                    onChange={(e) => setForm({ ...form, heading: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
                  />
                </label>
              </div>
            )}

            <button
              type="submit"
              className="rounded-lg bg-cyan-500/20 px-4 py-2 font-medium text-cyan-200 hover:bg-cyan-500/30"
            >
              Save zone
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
          <h3 className="font-semibold">Import from DevTools</h3>
          <p className="mt-2 text-sm text-slate-400">
            Paste JSON exported from <code className="text-slate-200">/fdt</code> or saved export
            files.
          </p>
          <form className="mt-4 space-y-3" onSubmit={handleImport}>
            <textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              rows={10}
              placeholder='{"schemaVersion":1,"resource":"fdt_devtools","zones":[...]}'
              className="w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2 font-mono text-xs text-slate-200"
            />
            <button
              type="submit"
              className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/30"
            >
              Import JSON
            </button>
          </form>
        </section>
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
        <h3 className="font-semibold">Registered Zones ({zones.length})</h3>
        {zones.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No zones yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="pb-2 pr-4">ID</th>
                  <th className="pb-2 pr-4">Label</th>
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">Purpose</th>
                  <th className="pb-2 pr-4">Coords</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((zone) => (
                  <tr key={zone.id} className="border-t border-white/5">
                    <td className="py-3 pr-4 font-mono text-xs text-cyan-200">{zone.id}</td>
                    <td className="py-3 pr-4">{zone.label}</td>
                    <td className="py-3 pr-4">{zone.type}</td>
                    <td className="py-3 pr-4">{zone.purpose}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-400">
                      {zone.coords
                        .map((coord) => `${coord.x.toFixed(2)}, ${coord.y.toFixed(2)}, ${coord.z.toFixed(2)}`)
                        .join(" · ")}
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => void handleDeleteZone(zone.id)}
                        className="text-xs text-rose-300 hover:text-rose-200"
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
      </section>
    </div>
  );
}
