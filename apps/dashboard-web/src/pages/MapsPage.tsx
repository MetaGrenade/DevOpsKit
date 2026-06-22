import { useEffect, useState } from "react";
import {
  EmptyState,
  PageAlert,
  PageIntro,
  PageStack,
  Panel,
  StatGrid,
  StatTile,
} from "../components/ui/page";
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
    return (
      <PageStack>
        <p className="panel-subtext">Loading maps…</p>
      </PageStack>
    );
  }

  if (!activeWorkspace) {
    return (
      <PageStack>
        <EmptyState
          title="Map / MLO Packaging Assistant"
          description="Select an active workspace to manage map packages."
        />
      </PageStack>
    );
  }

  return (
    <PageStack>
      <PageIntro
        title="Map / MLO Packaging Assistant"
        description="Scaffold map resources, audit stream assets (.ymap/.ytyp/.ybn), track packaging checklists, and export QA teleport test points."
        actions={
          <div className="btn-row" style={{ marginTop: 0 }}>
            <button type="button" disabled={busy} onClick={() => void runScan()} className="btn btn-accent btn-sm">
              {busy ? "Working…" : "Scan maps"}
            </button>
            <button type="button" disabled={busy} onClick={() => void runAudit()} className="btn btn-secondary btn-sm">
              Run audit
            </button>
            <button type="button" disabled={busy} onClick={() => void exportTestPoints()} className="btn btn-secondary btn-sm">
              Export test points
            </button>
          </div>
        }
      />

      <Panel className="panel-compact">
        <p className="panel-subtext">
          CLI: <code className="inline-code">fdt map new</code> · <code className="inline-code">fdt map audit</code> ·{" "}
          <code className="inline-code">fdt map export-test-points</code>
        </p>
        {message && <PageAlert>{message}</PageAlert>}
      </Panel>

      <Panel className="panel-compact">
        <h3 className="panel-heading">New map scaffold</h3>
        <div className="btn-row panel-section">
          <input
            value={newMapForm.resourceName}
            onChange={(e) => setNewMapForm({ ...newMapForm, resourceName: e.target.value })}
            className="form-control"
            placeholder="Resource name"
          />
          <input
            value={newMapForm.label}
            onChange={(e) => setNewMapForm({ ...newMapForm, label: e.target.value })}
            className="form-control"
            placeholder="Label"
          />
          <button type="button" disabled={busy} onClick={() => void createMap()} className="btn btn-accent btn-sm">
            Scaffold map
          </button>
        </div>
      </Panel>

      <Panel className="panel-compact">
        <h3 className="panel-heading">Map registry ({maps.length})</h3>
        <div className="panel-section space-y-3">
          {maps.length === 0 ? (
            <p className="panel-subtext">No maps registered yet. Scaffold a map or run an audit to sync resources.</p>
          ) : (
            maps.map((mapPackage) => (
              <article key={mapPackage.id} className="finding-card text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{mapPackage.label}</div>
                    <div className="text-xs text-[var(--color-muted)]">
                      {mapPackage.id} · {mapPackage.resourceName} · {mapPackage.status}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void refreshChecklist(mapPackage.id)}
                    className="btn btn-secondary btn-sm"
                  >
                    Refresh checklist
                  </button>
                </div>
                {mapPackage.checklist.length > 0 && (
                  <ul className="list-plain mt-2 text-xs text-[var(--color-muted)]">
                    {mapPackage.checklist.map((item) => (
                      <li key={item.id} className={item.passed ? "path-ok" : ""}>
                        {item.passed ? "✓" : "○"} {item.label}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))
          )}
        </div>
      </Panel>

      {report && (
        <Panel className="panel-compact">
          <h3 className="panel-heading">Audit findings</h3>
          <StatGrid columns={3}>
            <StatTile label="Errors" value={report.summary.errors} tone="danger" />
            <StatTile label="Warnings" value={report.summary.warnings} tone="warning" />
            <StatTile label="Info" value={report.summary.info} tone="muted" />
          </StatGrid>
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
