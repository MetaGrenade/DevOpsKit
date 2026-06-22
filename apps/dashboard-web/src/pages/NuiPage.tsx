import { useEffect, useState } from "react";
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
    const response = await fetch("/api/v1/nui/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
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
    return <p className="text-sm text-slate-400">Loading NUI resources…</p>;
  }

  if (!activeWorkspace) {
    return (
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <h2 className="text-xl font-semibold">NUI Schema Sync</h2>
        <p className="mt-2 text-sm text-slate-400">Select an active workspace to manage typed NUI bridge schemas.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <h2 className="text-xl font-semibold">NUI Schema Sync</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          Keep `shared/nui-bridge.json`, Lua callbacks/messages, and TypeScript wrappers in sync across NUI resources.
        </p>
        <p className="mt-3 text-sm text-slate-400">
          CLI: <code className="text-slate-200">fdt nui sync</code> ·{" "}
          <code className="text-slate-200">fdt nui validate</code> ·{" "}
          <code className="text-slate-200">fdt nui add-callback</code>
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" disabled={busy} onClick={() => void runSync()} className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-50">
            {busy ? "Working…" : "Sync schemas"}
          </button>
          <button type="button" disabled={busy} onClick={() => void runValidate()} className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-50">
            Validate schemas
          </button>
        </div>
        {message && <p className="mt-4 rounded-lg border border-white/10 bg-[#0b1020] px-4 py-2 text-sm text-slate-200">{message}</p>}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
        <h3 className="text-lg font-semibold">NUI resources ({resources.length})</h3>
        <div className="mt-4 space-y-2">
          {resources.length === 0 ? (
            <p className="text-sm text-slate-400">No NUI resources with shared/nui-bridge.json found.</p>
          ) : (
            resources.map((resource) => (
              <article key={resource.resourceName} className="rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2 text-sm">
                <div className="font-medium">{resource.resourceName}</div>
                <div className="text-xs text-slate-500">{resource.resourcePath}</div>
              </article>
            ))
          )}
        </div>
      </section>

      {report && (
        <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
          <h3 className="text-lg font-semibold">Validation summary</h3>
          <p className="mt-1 text-sm text-slate-400">
            {report.summary.synced}/{report.summary.resourcesChecked} in sync · {report.summary.errors} errors · {report.summary.warnings} warnings
          </p>
          <div className="mt-4 space-y-2">
            {report.resources.flatMap((resource) =>
              resource.findings.map((finding) => (
                <article key={`${resource.resourceName}:${finding.code}`} className="rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2 text-sm">
                  <div className="font-medium">{resource.resourceName} · {finding.code}</div>
                  <p className="mt-1 text-slate-400">{finding.message}</p>
                </article>
              )),
            )}
          </div>
        </section>
      )}
    </div>
  );
}
