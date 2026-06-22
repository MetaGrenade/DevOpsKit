import { useEffect, useState } from "react";
import type { WorkspaceWithConfig } from "../types/api";

type WorldTab = "blips" | "props" | "doors";

interface Blip {
  id: string;
  label: string;
  sprite: number;
  color: number;
  coords: { x: number; y: number; z: number };
}

interface PropPlacement {
  id: string;
  label: string;
  model: string;
  coords: { x: number; y: number; z: number; w?: number };
}

interface Door {
  id: string;
  label: string;
  locked: boolean;
  coords: { x: number; y: number; z: number; w?: number };
}

export default function WorldPage() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceWithConfig | null>(null);
  const [tab, setTab] = useState<WorldTab>("blips");
  const [blips, setBlips] = useState<Blip[]>([]);
  const [props, setProps] = useState<PropPlacement[]>([]);
  const [doors, setDoors] = useState<Door[]>([]);
  const [importJson, setImportJson] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    setMessage(null);

    const wsRes = await fetch("/api/v1/workspaces/active");
    if (wsRes.status === 404) {
      setActiveWorkspace(null);
      setLoading(false);
      return;
    }
    if (!wsRes.ok) {
      setMessage("Failed to load active workspace");
      setLoading(false);
      return;
    }
    setActiveWorkspace((await wsRes.json()) as WorkspaceWithConfig);

    const [blipsRes, propsRes, doorsRes] = await Promise.all([
      fetch("/api/v1/world/blips"),
      fetch("/api/v1/world/props"),
      fetch("/api/v1/world/doors"),
    ]);

    if (blipsRes.ok) setBlips(((await blipsRes.json()) as { blips: Blip[] }).blips);
    if (propsRes.ok) setProps(((await propsRes.json()) as { props: PropPlacement[] }).props);
    if (doorsRes.ok) setDoors(((await doorsRes.json()) as { doors: Door[] }).doors);

    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleImport(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    let payload: unknown;
    try {
      payload = JSON.parse(importJson);
    } catch {
      setMessage("Invalid JSON");
      return;
    }

    const response = await fetch("/api/v1/world/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = (await response.json()) as {
      message?: string;
      importedBlips?: number;
      importedProps?: number;
      importedDoors?: number;
    };

    if (!response.ok) {
      setMessage(result.message ?? "Import failed");
      return;
    }

    setImportJson("");
    setMessage(
      `Imported ${result.importedBlips ?? 0} blips, ${result.importedProps ?? 0} props, ${result.importedDoors ?? 0} doors`,
    );
    await loadData();
  }

  if (loading) {
    return <p className="text-sm text-slate-400">Loading world records…</p>;
  }

  if (!activeWorkspace) {
    return (
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <h2 className="text-xl font-semibold">World Tools</h2>
        <p className="mt-2 text-sm text-slate-400">Select an active workspace to manage blips, props, and doors.</p>
      </section>
    );
  }

  const items =
    tab === "blips" ? blips : tab === "props" ? props : doors;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <h2 className="text-xl font-semibold">World Tools</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          Import in-game exports from <code className="rounded bg-white/5 px-1.5 py-0.5">fdt_devtools</code> into{" "}
          <code className="rounded bg-white/5 px-1.5 py-0.5">.fdt/world/</code>. Commands:{" "}
          <code className="text-slate-200">/fdt_blip</code>,{" "}
          <code className="text-slate-200">/fdt_prop</code>,{" "}
          <code className="text-slate-200">/fdt_door</code>.
        </p>

        <form className="mt-6 space-y-3" onSubmit={handleImport}>
          <label className="block text-sm">
            <span className="text-slate-400">Import world export JSON</span>
            <textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              rows={8}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2 font-mono text-xs"
              placeholder='Paste export from /fdt export world JSON'
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/30"
          >
            Import
          </button>
        </form>

        {message && (
          <p className="mt-4 rounded-lg border border-white/10 bg-[#0b1020] px-4 py-2 text-sm text-slate-200">
            {message}
          </p>
        )}

        <div className="mt-6 flex gap-2 text-sm">
          {(["blips", "props", "doors"] as WorldTab[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`rounded-lg px-3 py-1.5 capitalize ${
                tab === value ? "bg-cyan-500/20 text-cyan-200" : "text-slate-400 hover:text-white"
              }`}
            >
              {value} ({value === "blips" ? blips.length : value === "props" ? props.length : doors.length})
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
        <h3 className="font-semibold capitalize">{tab}</h3>
        <div className="mt-4 space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-slate-400">No records yet.</p>
          ) : (
            items.map((item) => (
              <article key={item.id} className="rounded-lg border border-white/10 bg-[#0b1020] p-4 text-sm">
                <div className="font-medium text-cyan-200">{item.label}</div>
                <div className="mono text-xs text-slate-500">{item.id}</div>
                {"model" in item && item.model && <div className="text-slate-400">{item.model}</div>}
                {"sprite" in item && (
                  <div className="text-slate-400">
                    sprite {item.sprite} · ({item.coords.x}, {item.coords.y}, {item.coords.z})
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
