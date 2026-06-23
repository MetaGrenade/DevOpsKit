import { useEffect, useState } from "react";
import {
  EmptyState,
  PageAlert,
  PageIntro,
  PageStack,
  Panel,
} from "../components/ui/page";
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

function severityBadgeClass(severity: string): string {
  switch (severity) {
    case "error":
      return "finding-badge finding-badge-error";
    case "warning":
      return "finding-badge finding-badge-warning";
    default:
      return "finding-badge finding-badge-info";
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
    return (
      <PageStack>
        <p className="panel-subtext">Loading vehicles…</p>
      </PageStack>
    );
  }

  if (!activeWorkspace) {
    return (
      <PageStack>
        <EmptyState
          title="Vehicle Pack Builder"
          description="Select an active workspace to manage vehicle packs."
          variant="workspace"
        />
      </PageStack>
    );
  }

  return (
    <PageStack>
      <PageIntro
        title="Vehicle Pack Builder"
        description="Scan add-on vehicle resources, validate spawn names and meta files, compare handling profiles, and export Qbox vehicle shop catalogs."
        actions={
          <div className="btn-row" style={{ marginTop: 0 }}>
            <button type="button" disabled={busy} onClick={() => void runScan()} className="btn btn-accent btn-sm">
              {busy ? "Working…" : "Scan vehicles"}
            </button>
            <button type="button" disabled={busy} onClick={() => void runAudit()} className="btn btn-secondary btn-sm">
              Run audit
            </button>
          </div>
        }
      />

      <Panel className="panel-compact">
        <p className="panel-subtext">
          CLI: <code className="inline-code">fdt vehicle scan</code> ·{" "}
          <code className="inline-code">fdt vehicle audit</code> ·{" "}
          <code className="inline-code">fdt vehicle export --adapter qbox</code>
        </p>
        {message && <PageAlert>{message}</PageAlert>}
      </Panel>

      <Panel className="panel-compact">
        <h3 className="panel-heading">Handling comparison</h3>
        <div className="btn-row panel-section">
          <input
            value={compareForm.baseline}
            onChange={(e) => setCompareForm({ ...compareForm, baseline: e.target.value })}
            className="form-control"
            placeholder="Baseline spawn"
          />
          <input
            value={compareForm.target}
            onChange={(e) => setCompareForm({ ...compareForm, target: e.target.value })}
            className="form-control"
            placeholder="Target spawn"
          />
          <button type="button" disabled={busy} onClick={() => void runCompare()} className="btn btn-secondary btn-sm">
            Compare
          </button>
        </div>
        {comparison && (
          <pre className="code-block panel-section">{JSON.stringify(comparison, null, 2)}</pre>
        )}
      </Panel>

      <Panel className="panel-compact">
        <h3 className="panel-heading">Vehicle registry ({vehicles.length})</h3>
        <div className="panel-section space-y-2">
          {vehicles.length === 0 ? (
            <p className="panel-subtext">No vehicles registered yet. Run a scan to index vehicle resources.</p>
          ) : (
            vehicles.map((vehicle) => (
              <article key={vehicle.spawnName} className="finding-card text-sm">
                <div className="font-medium">{vehicle.displayName}</div>
                <div className="text-xs text-[var(--color-muted)]">
                  {vehicle.spawnName} · {vehicle.category}
                  {vehicle.shop ? ` · ${vehicle.shop}` : ""}
                  {vehicle.emergency ? " · emergency" : ""}
                </div>
              </article>
            ))
          )}
        </div>
      </Panel>

      {report && (
        <Panel className="panel-compact">
          <h3 className="panel-heading">Audit findings</h3>
          <p className="panel-subtext">
            {report.summary.errors} errors · {report.summary.warnings} warnings · {report.summary.info} info
          </p>
          <div className="panel-section space-y-2">
            {report.findings.slice(0, 12).map((finding) => (
              <article key={finding.id} className="finding-card text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{finding.code}</span>
                  <span className={`text-xs ${severityBadgeClass(finding.severity)}`}>{finding.severity}</span>
                </div>
                <p className="mt-1 text-[var(--color-muted)]">{finding.message}</p>
              </article>
            ))}
          </div>
        </Panel>
      )}
    </PageStack>
  );
}
