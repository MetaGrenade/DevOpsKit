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
    return (
      <PageStack>
        <p className="panel-subtext">Loading dependency graph…</p>
      </PageStack>
    );
  }

  if (!activeWorkspace) {
    return (
      <PageStack>
        <EmptyState
          title="Dependency Graph"
          description="Select an active workspace to inspect resource dependencies."
        />
      </PageStack>
    );
  }

  return (
    <PageStack>
      <PageIntro
        title="Dependency Graph"
        description="Map manifest dependencies, file references, server.cfg startup order, and basic Lua event registration/trigger edges across your resource tree."
        actions={
          <button
            type="button"
            disabled={busy}
            onClick={() => void runBuild()}
            className="btn btn-accent btn-sm"
          >
            {busy ? "Working…" : "Build graph"}
          </button>
        }
      />

      <Panel className="panel-compact">
        <p className="panel-subtext">
          CLI: <code className="inline-code">fdt graph build</code> ·{" "}
          <code className="inline-code">fdt graph impacted --resource meta_core</code> ·{" "}
          <code className="inline-code">fdt graph export --format dot</code>
        </p>
        {message && <PageAlert>{message}</PageAlert>}
      </Panel>

      {report && (
        <Panel className="panel-compact">
          <h3 className="panel-heading">Graph summary</h3>
          <StatGrid columns={3}>
            <StatTile label="Resources" value={report.summary.resources} />
            <StatTile label="Dependency edges" value={report.summary.dependencyEdges} />
            <StatTile label="Event edges" value={report.summary.eventEdges} />
          </StatGrid>
        </Panel>
      )}

      <Panel className="panel-compact">
        <h3 className="panel-heading">Impact analysis</h3>
        <div className="btn-row panel-section">
          <input
            value={resourceName}
            onChange={(e) => setResourceName(e.target.value)}
            className="form-control"
            placeholder="Resource name"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void runImpact()}
            className="btn btn-secondary btn-sm"
          >
            Find impacted resources
          </button>
        </div>
        {impact && (
          <div className="panel-section space-y-2 text-sm">
            <p>Direct dependents: {impact.directDependents.join(", ") || "(none)"}</p>
            <p>Transitive dependents: {impact.transitiveDependents.join(", ") || "(none)"}</p>
          </div>
        )}
      </Panel>

      {report && (
        <Panel className="panel-compact">
          <h3 className="panel-heading">Sample edges</h3>
          <div className="panel-section space-y-2">
            {report.edges.slice(0, 20).map((edge) => (
              <article key={edge.id} className="finding-card text-sm">
                <div className="font-medium">{edge.type}</div>
                <div className="text-xs text-[var(--color-muted)]">
                  {edge.source} → {edge.target}
                </div>
              </article>
            ))}
          </div>
        </Panel>
      )}
    </PageStack>
  );
}
