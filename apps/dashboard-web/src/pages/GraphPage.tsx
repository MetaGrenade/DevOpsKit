import { useEffect, useState } from "react";
import type { WorkspaceWithConfig } from "../types/api";

interface GraphSummary {
  resources: number;
  nodes: number;
  edges: number;
  dependencyEdges: number;
  fileReferenceEdges: number;
  eventEdges: number;
}

interface GraphReport {
  summary: GraphSummary;
  nodes: Array<{ id: string; type: string; label: string }>;
  edges: Array<{ id: string; type: string; source: string; target: string; resourceName?: string }>;
}

interface ImpactReport {
  resourceName: string;
  directDependents: string[];
  transitiveDependents: string[];
}

export default function GraphPage() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceWithConfig | null>(null);
  const [report, setReport] = useState<GraphReport | null>(null);
  const [impact, setImpact] = useState<ImpactReport | null>(null);
  const [resourceName, setResourceName] = useState("meta_core");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

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

    const reportRes = await fetch("/api/v1/graph");
    if (reportRes.ok) {
      setReport(((await reportRes.json()) as { report: GraphReport }).report);
    } else {
      setReport(null);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function runBuild() {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/v1/graph/build", { method: "POST" });
    const payload = (await response.json()) as { message?: string; report?: GraphReport };
    if (!response.ok) {
      setMessage(payload.message ?? "Graph build failed");
      setBusy(false);
      return;
    }
    setReport(payload.report ?? null);
    setMessage(`Built graph with ${payload.report?.summary.edges ?? 0} edges`);
    setBusy(false);
  }

  async function runImpact() {
    setBusy(true);
    setMessage(null);
    const response = await fetch(`/api/v1/graph/impacted?resource=${encodeURIComponent(resourceName)}`);
    const payload = (await response.json()) as { message?: string; impact?: ImpactReport };
    if (!response.ok) {
      setMessage(payload.message ?? "Impact lookup failed");
      setImpact(null);
      setBusy(false);
      return;
    }
    setImpact(payload.impact ?? null);
    setBusy(false);
  }

  if (loading) {
    return <p className="text-sm text-slate-400">Loading dependency graph…</p>;
  }

  if (!activeWorkspace) {
    return (
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <h2 className="text-xl font-semibold">Dependency Graph</h2>
        <p className="mt-2 text-sm text-slate-400">Select an active workspace to inspect resource dependencies.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <h2 className="text-xl font-semibold">Dependency Graph</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          Map manifest dependencies, file references, server.cfg startup order, and basic Lua event registration/trigger
          edges across your resource tree.
        </p>
        <p className="mt-3 text-sm text-slate-400">
          CLI: <code className="text-slate-200">fdt graph build</code> ·{" "}
          <code className="text-slate-200">fdt graph impacted --resource meta_core</code> ·{" "}
          <code className="text-slate-200">fdt graph export --format dot</code>
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" disabled={busy} onClick={() => void runBuild()} className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-50">
            {busy ? "Working…" : "Build graph"}
          </button>
        </div>
        {message && <p className="mt-4 rounded-lg border border-white/10 bg-[#0b1020] px-4 py-2 text-sm text-slate-200">{message}</p>}
      </section>

      {report && (
        <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
          <h3 className="text-lg font-semibold">Graph summary</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-[#0b1020] px-4 py-3 text-sm">{report.summary.resources} resources</div>
            <div className="rounded-lg border border-white/10 bg-[#0b1020] px-4 py-3 text-sm">{report.summary.dependencyEdges} dependency edges</div>
            <div className="rounded-lg border border-white/10 bg-[#0b1020] px-4 py-3 text-sm">{report.summary.eventEdges} event edges</div>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
        <h3 className="text-lg font-semibold">Impact analysis</h3>
        <div className="mt-4 flex flex-wrap gap-3">
          <input value={resourceName} onChange={(e) => setResourceName(e.target.value)} className="rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2 text-sm" placeholder="Resource name" />
          <button type="button" disabled={busy} onClick={() => void runImpact()} className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/15 disabled:opacity-50">
            Find impacted resources
          </button>
        </div>
        {impact && (
          <div className="mt-4 space-y-2 text-sm text-slate-300">
            <p>Direct dependents: {impact.directDependents.join(", ") || "(none)"}</p>
            <p>Transitive dependents: {impact.transitiveDependents.join(", ") || "(none)"}</p>
          </div>
        )}
      </section>

      {report && (
        <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
          <h3 className="text-lg font-semibold">Sample edges</h3>
          <div className="mt-4 space-y-2">
            {report.edges.slice(0, 20).map((edge) => (
              <article key={edge.id} className="rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2 text-sm">
                <div className="font-medium">{edge.type}</div>
                <div className="text-xs text-slate-500">{edge.source} → {edge.target}</div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
