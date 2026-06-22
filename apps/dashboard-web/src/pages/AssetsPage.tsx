import { useEffect, useState } from "react";
import type { WorkspaceWithConfig } from "../types/api";

interface ResourceSummary {
  resource: string;
  resourcePath: string;
  assetCount: number;
  totalBytes: number;
  ytdBytes: number;
}

interface DuplicateGroup {
  fileName: string;
  occurrences: Array<{
    id: string;
    resource: string;
    relativePath: string;
    sizeBytes: number;
  }>;
}

interface Finding {
  id: string;
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  resource?: string;
}

interface AssetAuditorReport {
  workspaceName: string;
  generatedAt: string;
  budget: {
    maxResourceMb: number;
    maxYtdMb: number;
    maxFileMb?: number;
  };
  summary: {
    resourcesWithStream: number;
    assetsIndexed: number;
    totalBytes: number;
    duplicateFileNames: number;
    errors: number;
    warnings: number;
    info: number;
  };
  resourceSummaries: ResourceSummary[];
  duplicateGroups: DuplicateGroup[];
  findings: Finding[];
}

function bytesToMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(2);
}

function severityClass(severity: Finding["severity"]): string {
  switch (severity) {
    case "error":
      return "text-rose-300 bg-rose-500/10";
    case "warning":
      return "text-amber-300 bg-amber-500/10";
    default:
      return "text-slate-300 bg-slate-500/10";
  }
}

export default function AssetsPage() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceWithConfig | null>(null);
  const [report, setReport] = useState<AssetAuditorReport | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  async function loadReport() {
    setStatus("loading");
    setMessage(null);

    const wsRes = await fetch("/api/v1/workspaces/active");
    if (wsRes.status === 404) {
      setActiveWorkspace(null);
      setReport(null);
      setStatus("missing");
      return;
    }
    if (!wsRes.ok) throw new Error("Failed to load active workspace");
    setActiveWorkspace((await wsRes.json()) as WorkspaceWithConfig);

    const response = await fetch("/api/v1/reports/asset-auditor");
    if (response.status === 404) {
      setReport(null);
      setStatus("missing");
      return;
    }
    if (!response.ok) throw new Error("Failed to load asset report");
    setReport((await response.json()) as AssetAuditorReport);
    setStatus("ready");
  }

  useEffect(() => {
    void loadReport().catch(() => setStatus("error"));
  }, []);

  async function runAudit() {
    setMessage(null);
    const response = await fetch("/api/v1/workspaces/active/audit-stream", { method: "POST" });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.message ?? "Audit failed");
      return;
    }
    setMessage(
      `Audited ${payload.summary.assetsIndexed} assets (${payload.summary.duplicateFileNames} duplicate filenames, ${payload.summary.warnings} warnings)`,
    );
    await loadReport();
  }

  if (status === "loading") {
    return <p className="text-slate-400">Loading asset report…</p>;
  }

  if (!activeWorkspace) {
    return (
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <h2 className="text-xl font-semibold">Asset Auditor</h2>
        <p className="mt-2 text-sm text-slate-400">Select or register a workspace first.</p>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Asset Auditor</h2>
            <p className="mt-1 text-sm text-slate-400">
              Stream assets for <span className="text-cyan-200">{activeWorkspace.name}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => void runAudit()}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium hover:bg-cyan-500"
          >
            Run stream audit
          </button>
        </div>

        {message && (
          <p className="mt-4 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
            {message}
          </p>
        )}

        {status === "missing" && (
          <p className="mt-4 text-sm text-slate-400">
            No asset report yet. Run a stream audit or use{" "}
            <code className="rounded bg-white/5 px-1.5 py-0.5">pnpm fdt audit stream</code>.
          </p>
        )}

        {report && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-[#0b1020] p-4">
              <p className="text-xs uppercase text-slate-500">Assets indexed</p>
              <p className="mt-1 text-2xl font-semibold">{report.summary.assetsIndexed}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0b1020] p-4">
              <p className="text-xs uppercase text-slate-500">Total stream size</p>
              <p className="mt-1 text-2xl font-semibold">{bytesToMb(report.summary.totalBytes)} MB</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0b1020] p-4">
              <p className="text-xs uppercase text-slate-500">Duplicate filenames</p>
              <p className="mt-1 text-2xl font-semibold text-amber-300">
                {report.summary.duplicateFileNames}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0b1020] p-4">
              <p className="text-xs uppercase text-slate-500">Warnings</p>
              <p className="mt-1 text-2xl font-semibold">{report.summary.warnings}</p>
            </div>
          </div>
        )}
      </section>

      {report && report.resourceSummaries.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
          <h3 className="font-semibold">Resource size ranking</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="pb-2 pr-4">Resource</th>
                  <th className="pb-2 pr-4">Assets</th>
                  <th className="pb-2 pr-4">Total MB</th>
                  <th className="pb-2">YTD MB</th>
                </tr>
              </thead>
              <tbody>
                {report.resourceSummaries.map((summary) => (
                  <tr key={summary.resource} className="border-t border-white/5">
                    <td className="py-2 pr-4 text-cyan-100">{summary.resource}</td>
                    <td className="py-2 pr-4">{summary.assetCount}</td>
                    <td className="py-2 pr-4">{bytesToMb(summary.totalBytes)}</td>
                    <td className="py-2">{bytesToMb(summary.ytdBytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {report && report.duplicateGroups.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
          <h3 className="font-semibold">Duplicate filenames</h3>
          <ul className="mt-4 space-y-4">
            {report.duplicateGroups.map((group) => (
              <li key={group.fileName} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="font-medium text-amber-200">{group.fileName}</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-300">
                  {group.occurrences.map((occurrence) => (
                    <li key={occurrence.id}>
                      {occurrence.resource}/{occurrence.relativePath}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      {report && report.findings.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
          <h3 className="font-semibold">Findings</h3>
          <ul className="mt-4 space-y-2">
            {report.findings.map((finding) => (
              <li
                key={finding.id}
                className={`rounded-lg px-3 py-2 text-sm ${severityClass(finding.severity)}`}
              >
                {finding.resource ? `[${finding.resource}] ` : ""}
                {finding.message}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
