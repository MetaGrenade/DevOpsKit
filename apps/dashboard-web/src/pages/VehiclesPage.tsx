import { useEffect, useState } from "react";
import type { WorkspaceWithConfig } from "../types/api";

interface Vehicle {
  spawnName: string;
  displayName: string;
  category: string;
  price?: number;
  shop?: string;
  emergency: boolean;
  restrictedJobs: string[];
}

interface VehicleFinding {
  id: string;
  severity: string;
  code: string;
  message: string;
  spawnName?: string;
  resourceName?: string;
}

interface VehicleReport {
  summary: {
    vehiclesChecked: number;
    resourcesScanned: number;
    errors: number;
    warnings: number;
    info: number;
  };
  findings: VehicleFinding[];
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

export default function VehiclesPage() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceWithConfig | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [report, setReport] = useState<VehicleReport | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [compareForm, setCompareForm] = useState({ baseline: "police2", target: "meta_cvpi" });
  const [comparison, setComparison] = useState<Record<string, unknown> | null>(null);

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

    const vehiclesRes = await fetch("/api/v1/vehicles");
    if (vehiclesRes.ok) {
      setVehicles(((await vehiclesRes.json()) as { vehicles: Vehicle[] }).vehicles);
    }

    const reportRes = await fetch("/api/v1/reports/vehicle-audit");
    if (reportRes.ok) {
      setReport(((await reportRes.json()) as { report: VehicleReport }).report);
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
    const response = await fetch("/api/v1/vehicles/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const payload = (await response.json()) as { message?: string; vehiclesIndexed?: number };
    if (!response.ok) {
      setMessage(payload.message ?? "Vehicle scan failed");
      setBusy(false);
      return;
    }
    setMessage(`Scanned ${payload.vehiclesIndexed ?? 0} vehicle(s)`);
    await loadData();
    setBusy(false);
  }

  async function runAudit() {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/v1/vehicles/audit", { method: "POST" });
    const payload = (await response.json()) as { message?: string; passed?: boolean };
    if (!response.ok) {
      setMessage(payload.message ?? "Vehicle audit failed");
      setBusy(false);
      return;
    }
    setMessage(`Vehicle audit ${payload.passed ? "passed" : "failed"}`);
    await loadData();
    setBusy(false);
  }

  async function runCompare() {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/v1/vehicles/compare-handling", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(compareForm),
    });
    const payload = (await response.json()) as { message?: string; comparison?: { deltas: Record<string, unknown> } };
    if (!response.ok) {
      setMessage(payload.message ?? "Handling comparison failed");
      setComparison(null);
      setBusy(false);
      return;
    }
    setComparison(payload.comparison?.deltas ?? null);
    setBusy(false);
  }

  if (loading) {
    return <p className="text-sm text-slate-400">Loading vehicles…</p>;
  }

  if (!activeWorkspace) {
    return (
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <h2 className="text-xl font-semibold">Vehicle Pack Builder</h2>
        <p className="mt-2 text-sm text-slate-400">Select an active workspace to manage vehicle packs.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <h2 className="text-xl font-semibold">Vehicle Pack Builder</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          Scan add-on vehicle resources, validate spawn names and meta files, compare handling profiles, and export
          Qbox vehicle shop catalogs.
        </p>
        <p className="mt-3 text-sm text-slate-400">
          CLI: <code className="text-slate-200">fdt vehicle scan</code> ·{" "}
          <code className="text-slate-200">fdt vehicle audit</code> ·{" "}
          <code className="text-slate-200">fdt vehicle export --adapter qbox</code>
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" disabled={busy} onClick={() => void runScan()} className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-50">
            {busy ? "Working…" : "Scan vehicles"}
          </button>
          <button type="button" disabled={busy} onClick={() => void runAudit()} className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-50">
            Run audit
          </button>
        </div>
        {message && <p className="mt-4 rounded-lg border border-white/10 bg-[#0b1020] px-4 py-2 text-sm text-slate-200">{message}</p>}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
        <h3 className="text-lg font-semibold">Handling comparison</h3>
        <div className="mt-4 flex flex-wrap gap-3">
          <input value={compareForm.baseline} onChange={(e) => setCompareForm({ ...compareForm, baseline: e.target.value })} className="rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2 text-sm" placeholder="Baseline spawn" />
          <input value={compareForm.target} onChange={(e) => setCompareForm({ ...compareForm, target: e.target.value })} className="rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2 text-sm" placeholder="Target spawn" />
          <button type="button" disabled={busy} onClick={() => void runCompare()} className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/15 disabled:opacity-50">
            Compare
          </button>
        </div>
        {comparison && (
          <pre className="mt-4 overflow-x-auto rounded-lg bg-[#0b1020] p-3 text-xs text-slate-400">{JSON.stringify(comparison, null, 2)}</pre>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
        <h3 className="text-lg font-semibold">Vehicle registry ({vehicles.length})</h3>
        <div className="mt-4 space-y-2">
          {vehicles.length === 0 ? (
            <p className="text-sm text-slate-400">No vehicles registered yet. Run a scan to index vehicle resources.</p>
          ) : (
            vehicles.map((vehicle) => (
              <article key={vehicle.spawnName} className="rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2 text-sm">
                <div className="font-medium">{vehicle.displayName}</div>
                <div className="text-xs text-slate-500">
                  {vehicle.spawnName} · {vehicle.category}
                  {vehicle.shop ? ` · ${vehicle.shop}` : ""}
                  {vehicle.emergency ? " · emergency" : ""}
                </div>
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
