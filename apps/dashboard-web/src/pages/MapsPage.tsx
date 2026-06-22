import { useEffect, useState } from "react";
import type { WorkspaceWithConfig } from "../types/api";

interface MapChecklistItem {
  id: string;
  label: string;
  category: string;
  required: boolean;
  passed: boolean;
}

interface MapPackage {
  id: string;
  label: string;
  resourceName: string;
  resourcePath?: string;
  status: string;
  checklist: MapChecklistItem[];
}

interface MapFinding {
  id: string;
  severity: string;
  code: string;
  message: string;
  mapId?: string;
  resourceName?: string;
}

interface MapReport {
  summary: {
    mapsChecked: number;
    resourcesScanned: number;
    errors: number;
    warnings: number;
    info: number;
  };
  findings: MapFinding[];
}

function severityClass(severity: string): string {
  switch (severity) {
    case "error":
      return "text-rose-200 bg-rose-500/15";
    case "warning":
      return "text-amber-200 bg-amber-500/15";
    default:
      return "text-slate-300 bg-slate-500/10";
  }
}

export default function MapsPage() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceWithConfig | null>(null);
  const [maps, setMaps] = useState<MapPackage[]>([]);
  const [report, setReport] = useState<MapReport | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newMapForm, setNewMapForm] = useState({ resourceName: "meta_map_office", label: "Meta Office" });

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

    const mapsRes = await fetch("/api/v1/maps");
    if (mapsRes.ok) {
      setMaps(((await mapsRes.json()) as { maps: MapPackage[] }).maps);
    }

    const reportRes = await fetch("/api/v1/reports/map-audit");
    if (reportRes.ok) {
      setReport(((await reportRes.json()) as { report: MapReport }).report);
    } else {
      setReport(null);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function runScan() {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/v1/maps/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const payload = (await response.json()) as { message?: string; streamFiles?: number };
    if (!response.ok) {
      setMessage(payload.message ?? "Map scan failed");
      setBusy(false);
      return;
    }
    setMessage(`Scanned ${payload.streamFiles ?? 0} stream file(s)`);
    await loadData();
    setBusy(false);
  }

  async function runAudit() {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/v1/maps/audit", { method: "POST" });
    const payload = (await response.json()) as { message?: string; passed?: boolean };
    if (!response.ok) {
      setMessage(payload.message ?? "Map audit failed");
      setBusy(false);
      return;
    }
    setMessage(`Map audit ${payload.passed ? "passed" : "failed"}`);
    await loadData();
    setBusy(false);
  }

  async function createMap() {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/v1/maps/new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newMapForm),
    });
    const payload = (await response.json()) as { message?: string; map?: MapPackage };
    if (!response.ok) {
      setMessage(payload.message ?? "Map scaffold failed");
      setBusy(false);
      return;
    }
    setMessage(`Created map ${payload.map?.id ?? newMapForm.resourceName}`);
    await loadData();
    setBusy(false);
  }

  async function refreshChecklist(mapId: string) {
    setBusy(true);
    setMessage(null);
    const response = await fetch(`/api/v1/maps/${mapId}/checklist`, { method: "POST" });
    const payload = (await response.json()) as { message?: string; map?: MapPackage };
    if (!response.ok) {
      setMessage(payload.message ?? "Checklist refresh failed");
      setBusy(false);
      return;
    }
    setMessage(`Refreshed checklist for ${mapId} (${payload.map?.status ?? "unknown"})`);
    await loadData();
    setBusy(false);
  }

  async function exportTestPoints() {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/v1/maps/export-test-points", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const payload = (await response.json()) as { message?: string; reportPath?: string };
    if (!response.ok) {
      setMessage(payload.message ?? "Test point export failed");
      setBusy(false);
      return;
    }
    setMessage(`Exported test points to ${payload.reportPath ?? ".fdt/qa/map-test-points.json"}`);
    setBusy(false);
  }

  if (loading) {
    return <p className="text-sm text-slate-400">Loading maps…</p>;
  }

  if (!activeWorkspace) {
    return (
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <h2 className="text-xl font-semibold">Map / MLO Packaging Assistant</h2>
        <p className="mt-2 text-sm text-slate-400">Select an active workspace to manage map packages.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <h2 className="text-xl font-semibold">Map / MLO Packaging Assistant</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          Scaffold map resources, audit stream assets (.ymap/.ytyp/.ybn), track packaging checklists, and export QA
          teleport test points.
        </p>
        <p className="mt-3 text-sm text-slate-400">
          CLI: <code className="text-slate-200">fdt map new</code> ·{" "}
          <code className="text-slate-200">fdt map audit</code> ·{" "}
          <code className="text-slate-200">fdt map export-test-points</code>
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" disabled={busy} onClick={() => void runScan()} className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-50">
            {busy ? "Working…" : "Scan maps"}
          </button>
          <button type="button" disabled={busy} onClick={() => void runAudit()} className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-50">
            Run audit
          </button>
          <button type="button" disabled={busy} onClick={() => void exportTestPoints()} className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/15 disabled:opacity-50">
            Export test points
          </button>
        </div>
        {message && <p className="mt-4 rounded-lg border border-white/10 bg-[#0b1020] px-4 py-2 text-sm text-slate-200">{message}</p>}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
        <h3 className="text-lg font-semibold">New map scaffold</h3>
        <div className="mt-4 flex flex-wrap gap-3">
          <input value={newMapForm.resourceName} onChange={(e) => setNewMapForm({ ...newMapForm, resourceName: e.target.value })} className="rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2 text-sm" placeholder="Resource name" />
          <input value={newMapForm.label} onChange={(e) => setNewMapForm({ ...newMapForm, label: e.target.value })} className="rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2 text-sm" placeholder="Label" />
          <button type="button" disabled={busy} onClick={() => void createMap()} className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-50">
            Scaffold map
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
        <h3 className="text-lg font-semibold">Map registry ({maps.length})</h3>
        <div className="mt-4 space-y-3">
          {maps.length === 0 ? (
            <p className="text-sm text-slate-400">No maps registered yet. Scaffold a map or run an audit to sync resources.</p>
          ) : (
            maps.map((mapPackage) => (
              <article key={mapPackage.id} className="rounded-lg border border-white/10 bg-[#0b1020] px-3 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{mapPackage.label}</div>
                    <div className="text-xs text-slate-500">
                      {mapPackage.id} · {mapPackage.resourceName} · {mapPackage.status}
                    </div>
                  </div>
                  <button type="button" disabled={busy} onClick={() => void refreshChecklist(mapPackage.id)} className="rounded-lg bg-white/10 px-3 py-1 text-xs hover:bg-white/15 disabled:opacity-50">
                    Refresh checklist
                  </button>
                </div>
                {mapPackage.checklist.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-slate-400">
                    {mapPackage.checklist.map((item) => (
                      <li key={item.id} className={item.passed ? "text-emerald-300/90" : "text-slate-500"}>
                        {item.passed ? "✓" : "○"} {item.label}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))
          )}
        </div>
      </section>

      {report && (
        <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
          <h3 className="text-lg font-semibold">Audit findings</h3>
          <p className="mt-1 text-sm text-slate-400">
            {report.summary.errors} errors · {report.summary.warnings} warnings · {report.summary.info} info
          </p>
          <div className="mt-4 space-y-2">
            {report.findings.slice(0, 12).map((finding) => (
              <article key={finding.id} className="rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{finding.code}</span>
                  <span className={`rounded px-2 py-0.5 text-xs ${severityClass(finding.severity)}`}>{finding.severity}</span>
                </div>
                <p className="mt-1 text-slate-400">{finding.message}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
