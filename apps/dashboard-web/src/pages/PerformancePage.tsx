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

interface PerformanceResourceMetric {
  resource: string;
  avgMs?: number;
  maxMs?: number;
  memoryMb?: number;
  hitchCount?: number;
}

interface PerformanceSnapshot {
  id: string;
  label?: string;
  releaseId?: string;
  releaseVersion?: string;
  environment: string;
  capturedAt: string;
  playerCount?: number;
  source: string;
  resources: PerformanceResourceMetric[];
}

interface PerformanceComparisonChange {
  resource: string;
  metric: string;
  baselineValue: number;
  targetValue: number;
  changePercent: number;
  direction: "regression" | "improvement" | "unchanged";
}

interface PerformanceComparisonReport {
  generatedAt: string;
  thresholdPercent: number;
  baselineSnapshotId: string;
  baselineLabel?: string;
  targetSnapshotId: string;
  targetLabel?: string;
  summary: {
    resourcesCompared: number;
    regressions: number;
    improvements: number;
    unchanged: number;
  };
  changes: PerformanceComparisonChange[];
}

function directionBadgeClass(direction: string): string {
  switch (direction) {
    case "regression":
      return "finding-badge finding-badge-error";
    case "improvement":
      return "finding-badge finding-badge-info path-ok";
    default:
      return "finding-badge finding-badge-info";
  }
}

export default function PerformancePage() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceWithConfig | null>(null);
  const [snapshots, setSnapshots] = useState<PerformanceSnapshot[]>([]);
  const [report, setReport] = useState<PerformanceComparisonReport | null>(null);
  const [reportPath, setReportPath] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [importJson, setImportJson] = useState("");
  const [baselineId, setBaselineId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [threshold, setThreshold] = useState("10");
  const [busy, setBusy] = useState(false);

  async function loadData() {
    setStatus("loading");
    setMessage(null);

    const wsRes = await fetch("/api/v1/workspaces/active");
    if (wsRes.status === 404) {
      setActiveWorkspace(null);
      setSnapshots([]);
      setReport(null);
      setStatus("missing");
      return;
    }
    if (!wsRes.ok) {
      setStatus("error");
      setMessage("Failed to load active workspace");
      return;
    }
    setActiveWorkspace((await wsRes.json()) as WorkspaceWithConfig);

    const snapshotsRes = await fetch("/api/v1/performance/snapshots");
    if (snapshotsRes.ok) {
      const payload = (await snapshotsRes.json()) as { snapshots: PerformanceSnapshot[] };
      setSnapshots(payload.snapshots);
      if (!baselineId && payload.snapshots[1]) {
        setBaselineId(payload.snapshots[1].id);
      }
      if (!targetId && payload.snapshots[0]) {
        setTargetId(payload.snapshots[0].id);
      }
    }

    const reportRes = await fetch("/api/v1/reports/performance-comparison");
    if (reportRes.status === 404) {
      setReport(null);
      setReportPath(null);
      setStatus("ready");
      return;
    }
    if (!reportRes.ok) {
      setStatus("error");
      setMessage("Failed to load performance comparison report");
      return;
    }

    const payload = (await reportRes.json()) as {
      report: PerformanceComparisonReport;
      reportPath: string;
    };
    setReport(payload.report);
    setReportPath(payload.reportPath);
    setStatus("ready");
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleImport(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      const payload = JSON.parse(importJson) as unknown;
      const response = await fetch("/api/v1/performance/snapshots/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { message?: string; snapshot?: PerformanceSnapshot };
      if (!response.ok) {
        setMessage(body.message ?? "Import failed");
        setBusy(false);
        return;
      }

      setMessage(`Imported snapshot ${body.snapshot?.id ?? ""}`);
      setImportJson("");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleCompare(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    const response = await fetch("/api/v1/performance/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baselineSnapshotId: baselineId,
        targetSnapshotId: targetId,
        thresholdPercent: Number(threshold),
      }),
    });

    const body = (await response.json()) as { message?: string; report?: PerformanceComparisonReport };
    if (!response.ok) {
      setMessage(body.message ?? "Comparison failed");
      setBusy(false);
      return;
    }

    setMessage(
      `Comparison complete — ${body.report?.summary.regressions ?? 0} regressions, ${body.report?.summary.improvements ?? 0} improvements`,
    );
    await loadData();
    setBusy(false);
  }

  if (status === "loading") {
    return (
      <PageStack>
        <p className="panel-subtext">Loading performance snapshots…</p>
      </PageStack>
    );
  }

  if (!activeWorkspace) {
    return (
      <PageStack>
        <EmptyState
          title="Performance Dashboard"
          description="Select an active workspace to track profiler snapshots."
        />
      </PageStack>
    );
  }

  return (
    <PageStack>
      <PageIntro
        title="Performance Dashboard"
        description={
          <>
            Import profiler snapshots into{" "}
            <code className="inline-code">.fdt/performance/snapshots.json</code>, compare releases, and
            review regression reports in{" "}
            <code className="inline-code">.fdt/reports/performance-comparison.json</code>.
          </>
        }
      />

      <Panel className="panel-compact">
        <p className="panel-subtext">
          CLI: <code className="inline-code">fdt perf import snapshot.json</code> ·{" "}
          <code className="inline-code">fdt perf compare --from baseline --to target</code> ·{" "}
          <code className="inline-code">fdt perf report</code>
        </p>
        {message && <PageAlert>{message}</PageAlert>}
      </Panel>

      <div className="page-grid-2">
        <Panel className="panel-compact">
          <h3 className="panel-heading">Snapshots ({snapshots.length})</h3>
          <div className="panel-section space-y-2">
            {snapshots.length === 0 ? (
              <p className="panel-subtext">No snapshots imported yet.</p>
            ) : (
              snapshots.map((snapshot) => (
                <article key={snapshot.id} className="finding-card">
                  <div className="font-medium text-[var(--color-accent-ink)]">
                    {snapshot.label ?? snapshot.id}
                    {snapshot.releaseVersion ? ` · ${snapshot.releaseVersion}` : ""}
                  </div>
                  <div className="text-xs text-[var(--color-muted)]">
                    {snapshot.environment} · {new Date(snapshot.capturedAt).toLocaleString()} ·{" "}
                    {snapshot.resources.length} resources
                  </div>
                </article>
              ))
            )}
          </div>

          <form className="form-stack panel-section" onSubmit={handleImport}>
            <h4 className="panel-heading">Import snapshot JSON</h4>
            <textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              rows={6}
              placeholder='{"id":"perf_001","capturedAt":"...","resources":[{"resource":"meta_inventory","avgMs":0.4}]}'
              className="form-control form-control-mono"
            />
            <button
              type="submit"
              disabled={busy || !importJson.trim()}
              className="btn btn-accent btn-sm"
            >
              Import snapshot
            </button>
          </form>
        </Panel>

        <Panel className="panel-compact">
          <h3 className="panel-heading">Compare snapshots</h3>
          <form className="form-stack panel-section" onSubmit={handleCompare}>
            <label className="form-field">
              <span className="form-label">Baseline</span>
              <select
                value={baselineId}
                onChange={(e) => setBaselineId(e.target.value)}
                className="form-control"
              >
                <option value="">Select baseline</option>
                {snapshots.map((snapshot) => (
                  <option key={snapshot.id} value={snapshot.id}>
                    {snapshot.label ?? snapshot.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span className="form-label">Target</span>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="form-control"
              >
                <option value="">Select target</option>
                {snapshots.map((snapshot) => (
                  <option key={snapshot.id} value={snapshot.id}>
                    {snapshot.label ?? snapshot.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span className="form-label">Threshold (%)</span>
              <input
                type="number"
                min={0}
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="form-control"
              />
            </label>
            <button
              type="submit"
              disabled={busy || !baselineId || !targetId}
              className="btn btn-primary btn-sm"
            >
              Run comparison
            </button>
          </form>

          {report && (
            <div className="panel-section">
              <h4 className="panel-heading">Latest comparison</h4>
              <p className="panel-subtext">
                {report.baselineLabel ?? report.baselineSnapshotId} →{" "}
                {report.targetLabel ?? report.targetSnapshotId}
                {reportPath ? ` · ${reportPath}` : ""}
              </p>
              <StatGrid columns={3}>
                <StatTile label="Regressions" value={report.summary.regressions} tone="danger" />
                <StatTile label="Improvements" value={report.summary.improvements} tone="success" />
                <StatTile label="Unchanged" value={report.summary.unchanged} tone="muted" />
              </StatGrid>
            </div>
          )}
        </Panel>
      </div>

      {report && report.changes.length > 0 && (
        <Panel className="panel-compact">
          <h3 className="panel-heading">Metric changes</h3>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Resource</th>
                  <th>Metric</th>
                  <th>Baseline</th>
                  <th>Target</th>
                  <th>Change</th>
                  <th>Direction</th>
                </tr>
              </thead>
              <tbody>
                {report.changes.map((change) => (
                  <tr key={`${change.resource}-${change.metric}`}>
                    <td className="text-[var(--color-accent-ink)]">{change.resource}</td>
                    <td>{change.metric}</td>
                    <td>{change.baselineValue}</td>
                    <td>{change.targetValue}</td>
                    <td>{change.changePercent}%</td>
                    <td>
                      <span className={`text-xs ${directionBadgeClass(change.direction)}`}>
                        {change.direction}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </PageStack>
  );
}
