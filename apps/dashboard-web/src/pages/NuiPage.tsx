import { useEffect, useState } from "react";
import {
  EmptyState,
  PageAlert,
  PageIntro,
  PageStack,
  Panel,
} from "../components/ui/page";
import type { WorkspaceWithConfig } from "../types/api";

interface NuiResource {
  resourceName: string;
  resourcePath: string;
}

interface NuiReport {
  summary: {
    resourcesChecked: number;
    synced: number;
    errors: number;
    warnings: number;
  };
  resources: Array<{
    resourceName: string;
    synced: boolean;
    findings: Array<{ code: string; message: string; severity: string }>;
  }>;
}

export default function NuiPage() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceWithConfig | null>(null);
  const [resources, setResources] = useState<NuiResource[]>([]);
  const [report, setReport] = useState<NuiReport | null>(null);
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

    const listRes = await fetch("/api/v1/nui");
    if (listRes.ok) {
      setResources(((await listRes.json()) as { resources: NuiResource[] }).resources);
    }

    const reportRes = await fetch("/api/v1/reports/nui-schema-sync");
    if (reportRes.ok) {
      setReport(((await reportRes.json()) as { report: NuiReport }).report);
    } else {
      setReport(null);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function runSync() {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/v1/nui/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const payload = (await response.json()) as { message?: string; resources?: unknown[] };
    if (!response.ok) {
      setMessage(payload.message ?? "NUI sync failed");
      setBusy(false);
      return;
    }
    setMessage(`Synced ${payload.resources?.length ?? 0} NUI resource(s)`);
    await loadData();
    setBusy(false);
  }

  async function runValidate() {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/v1/nui/validate", { method: "POST" });
    const payload = (await response.json()) as { message?: string; passed?: boolean };
    if (!response.ok) {
      setMessage(payload.message ?? "NUI validation failed");
      setBusy(false);
      return;
    }
    setMessage(`NUI schema validation ${payload.passed ? "passed" : "failed"}`);
    await loadData();
    setBusy(false);
  }

  if (loading) {
    return (
      <PageStack>
        <p className="panel-subtext">Loading NUI resources…</p>
      </PageStack>
    );
  }

  if (!activeWorkspace) {
    return (
      <PageStack>
        <EmptyState
          title="NUI Schema Sync"
          description="Select an active workspace to manage typed NUI bridge schemas."
          variant="workspace"
        />
      </PageStack>
    );
  }

  return (
    <PageStack>
      <PageIntro
        title="NUI Schema Sync"
        description="Keep shared/nui-bridge.json, Lua callbacks/messages, and TypeScript wrappers in sync across NUI resources."
        actions={
          <div className="btn-row" style={{ marginTop: 0 }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void runSync()}
              className="btn btn-accent btn-sm"
            >
              {busy ? "Working…" : "Sync schemas"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void runValidate()}
              className="btn btn-secondary btn-sm"
            >
              Validate schemas
            </button>
          </div>
        }
      />

      <Panel className="panel-compact">
        <p className="panel-subtext">
          CLI: <code className="inline-code">fdt nui sync</code> ·{" "}
          <code className="inline-code">fdt nui validate</code> ·{" "}
          <code className="inline-code">fdt nui add-callback</code>
        </p>
        {message && <PageAlert>{message}</PageAlert>}
      </Panel>

      <Panel className="panel-compact">
        <h3 className="panel-heading">NUI resources ({resources.length})</h3>
        <div className="panel-section space-y-2">
          {resources.length === 0 ? (
            <p className="panel-subtext">No NUI resources with shared/nui-bridge.json found.</p>
          ) : (
            resources.map((resource) => (
              <article key={resource.resourceName} className="finding-card text-sm">
                <div className="font-medium">{resource.resourceName}</div>
                <div className="text-xs text-[var(--color-muted)]">{resource.resourcePath}</div>
              </article>
            ))
          )}
        </div>
      </Panel>

      {report && (
        <Panel className="panel-compact">
          <h3 className="panel-heading">Validation summary</h3>
          <p className="panel-subtext">
            {report.summary.synced}/{report.summary.resourcesChecked} in sync · {report.summary.errors}{" "}
            errors · {report.summary.warnings} warnings
          </p>
          <div className="panel-section space-y-2">
            {report.resources.flatMap((resource) =>
              resource.findings.map((finding) => (
                <article
                  key={`${resource.resourceName}:${finding.code}`}
                  className="finding-card text-sm"
                >
                  <div className="font-medium">
                    {resource.resourceName} · {finding.code}
                  </div>
                  <p className="mt-1 text-[var(--color-muted)]">{finding.message}</p>
                </article>
              )),
            )}
          </div>
        </Panel>
      )}
    </PageStack>
  );
}
