import { useEffect, useState } from "react";
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

function directionClass(direction: string): string {
  switch (direction) {
    case "regression":
      return "text-rose-200 bg-rose-500/15";
    case "improvement":
      return "text-emerald-200 bg-emerald-500/15";
    default:
      return "text-slate-300 bg-slate-500/10";
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
    return <p className="text-sm text-slate-400">Loading performance snapshots…</p>;
  }

  if (!activeWorkspace) {
    return (
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <h2 className="text-xl font-semibold">Performance Dashboard</h2>
        <p className="mt-2 text-sm text-slate-400">Select an active workspace to track profiler snapshots.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <h2 className="text-xl font-semibold">Performance Dashboard</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          Import profiler snapshots into{" "}
          <code className="rounded bg-white/5 px-1.5 py-0.5">.fdt/performance/snapshots.json</code>,
          compare releases, and review regression reports in{" "}
          <code className="rounded bg-white/5 px-1.5 py-0.5">.fdt/reports/performance-comparison.json</code>.
        </p>
        <p className="mt-3 text-sm text-slate-400">
          CLI:{" "}
          <code className="text-slate-200">fdt perf import snapshot.json</code> ·{" "}
          <code className="text-slate-200">fdt perf compare --from baseline --to target</code> ·{" "}
          <code className="text-slate-200">fdt perf report</code>
        </p>

        {message && (
          <p className="mt-4 rounded-lg border border-white/10 bg-[#0b1020] px-4 py-2 text-sm text-slate-200">
            {message}
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
          <h3 className="font-semibold">Snapshots ({snapshots.length})</h3>
          <div className="mt-4 space-y-2">
            {snapshots.length === 0 ? (
              <p className="text-sm text-slate-400">No snapshots imported yet.</p>
            ) : (
              snapshots.map((snapshot) => (
                <article
                  key={snapshot.id}
                  className="rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2 text-sm"
                >
                  <div className="font-medium text-cyan-200">
                    {snapshot.label ?? snapshot.id}
                    {snapshot.releaseVersion ? ` · ${snapshot.releaseVersion}` : ""}
                  </div>
                  <div className="text-xs text-slate-500">
                    {snapshot.environment} · {new Date(snapshot.capturedAt).toLocaleString()} ·{" "}
                    {snapshot.resources.length} resources
                  </div>
                </article>
              ))
            )}
          </div>

          <form className="mt-6 space-y-3" onSubmit={handleImport}>
            <h4 className="font-medium">Import snapshot JSON</h4>
            <textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              rows={6}
              placeholder='{"id":"perf_001","capturedAt":"...","resources":[{"resource":"meta_inventory","avgMs":0.4}]}'
              className="w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2 font-mono text-xs"
            />
            <button
              type="submit"
              disabled={busy || !importJson.trim()}
              className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-50"
            >
              Import snapshot
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
          <h3 className="font-semibold">Compare snapshots</h3>
          <form className="mt-4 space-y-3 text-sm" onSubmit={handleCompare}>
            <label className="block">
              <span className="text-slate-400">Baseline</span>
              <select
                value={baselineId}
                onChange={(e) => setBaselineId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
              >
                <option value="">Select baseline</option>
                {snapshots.map((snapshot) => (
                  <option key={snapshot.id} value={snapshot.id}>
                    {snapshot.label ?? snapshot.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-slate-400">Target</span>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
              >
                <option value="">Select target</option>
                {snapshots.map((snapshot) => (
                  <option key={snapshot.id} value={snapshot.id}>
                    {snapshot.label ?? snapshot.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-slate-400">Threshold (%)</span>
              <input
                type="number"
                min={0}
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
              />
            </label>
            <button
              type="submit"
              disabled={busy || !baselineId || !targetId}
              className="rounded-lg bg-emerald-500/20 px-4 py-2 font-medium text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"
            >
              Run comparison
            </button>
          </form>

          {report && (
            <div className="mt-6">
              <h4 className="font-medium">Latest comparison</h4>
              <p className="mt-1 text-xs text-slate-500">
                {report.baselineLabel ?? report.baselineSnapshotId} →{" "}
                {report.targetLabel ?? report.targetSnapshotId}
                {reportPath ? ` · ${reportPath}` : ""}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-white/10 bg-[#0b1020] p-3">
                  <div className="text-xs text-slate-500">Regressions</div>
                  <div className="text-xl font-semibold text-rose-300">{report.summary.regressions}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#0b1020] p-3">
                  <div className="text-xs text-slate-500">Improvements</div>
                  <div className="text-xl font-semibold text-emerald-300">{report.summary.improvements}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#0b1020] p-3">
                  <div className="text-xs text-slate-500">Unchanged</div>
                  <div className="text-xl font-semibold text-slate-200">{report.summary.unchanged}</div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {report && report.changes.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
          <h3 className="font-semibold">Metric changes</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Resource</th>
                  <th className="px-3 py-2">Metric</th>
                  <th className="px-3 py-2">Baseline</th>
                  <th className="px-3 py-2">Target</th>
                  <th className="px-3 py-2">Change</th>
                  <th className="px-3 py-2">Direction</th>
                </tr>
              </thead>
              <tbody>
                {report.changes.map((change) => (
                  <tr key={`${change.resource}-${change.metric}`} className="border-t border-white/5">
                    <td className="px-3 py-2 text-cyan-200">{change.resource}</td>
                    <td className="px-3 py-2">{change.metric}</td>
                    <td className="px-3 py-2">{change.baselineValue}</td>
                    <td className="px-3 py-2">{change.targetValue}</td>
                    <td className="px-3 py-2">{change.changePercent}%</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs ${directionClass(change.direction)}`}>
                        {change.direction}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
