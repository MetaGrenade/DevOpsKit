import { useEffect, useState } from "react";
import {
  EmptyState,
  PageAlert,
  PageIntro,
  PageStack,
  Panel,
} from "../components/ui/page";
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
    return (
      <PageStack>
        <p className="panel-subtext">Loading world records…</p>
      </PageStack>
    );
  }

  if (!activeWorkspace) {
    return (
      <PageStack>
        <EmptyState
          title="World Tools"
          description="Select an active workspace to manage blips, props, and doors."
        />
      </PageStack>
    );
  }

  const items = tab === "blips" ? blips : tab === "props" ? props : doors;

  return (
    <PageStack>
      <PageIntro
        title="World Tools"
        description={
          <>
            Import in-game exports from <code className="inline-code">fdt_devtools</code> into{" "}
            <code className="inline-code">.fdt/world/</code>. Commands:{" "}
            <code className="inline-code">/fdt_blip</code>, <code className="inline-code">/fdt_prop</code>,{" "}
            <code className="inline-code">/fdt_door</code>.
          </>
        }
      />

      <Panel className="panel-compact">
        <form className="form-stack" onSubmit={handleImport}>
          <label className="form-field">
            <span className="form-label">Import world export JSON</span>
            <textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              rows={8}
              className="form-control form-control-mono"
              placeholder="Paste export from /fdt export world JSON"
            />
          </label>
          <button type="submit" className="btn btn-accent btn-sm">
            Import
          </button>
        </form>

        {message && <PageAlert>{message}</PageAlert>}

        <div className="tab-row">
          {(["blips", "props", "doors"] as WorldTab[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`tab-btn ${tab === value ? "tab-btn-active" : ""}`}
            >
              {value} ({value === "blips" ? blips.length : value === "props" ? props.length : doors.length})
            </button>
          ))}
        </div>
      </Panel>

      <Panel className="panel-compact">
        <h3 className="panel-heading capitalize">{tab}</h3>
        <div className="panel-section space-y-3">
          {items.length === 0 ? (
            <p className="panel-subtext">No records yet.</p>
          ) : (
            items.map((item) => (
              <article key={item.id} className="finding-card text-sm">
                <div className="font-medium text-[var(--color-accent-ink)]">{item.label}</div>
                <div className="font-mono text-xs text-[var(--color-muted)]">{item.id}</div>
                {"model" in item && item.model && <div>{item.model}</div>}
                {"sprite" in item && (
                  <div className="text-[var(--color-muted)]">
                    sprite {item.sprite} · ({item.coords.x}, {item.coords.y}, {item.coords.z})
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </Panel>
    </PageStack>
  );
}
