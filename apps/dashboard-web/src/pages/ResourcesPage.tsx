import { useEffect, useState } from "react";
import type { WorkspaceWithConfig } from "../types/api";

interface Finding {
  id: string;
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  resource?: string;
}

interface ResourceDoctorReport {
  workspaceName: string;
  generatedAt: string;
  summary: {
    resourcesScanned: number;
    errors: number;
    warnings: number;
    passed: number;
  };
  resources: Array<{ name: string; path: string; category?: string }>;
  findings: Finding[];
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

export default function ResourcesPage() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceWithConfig | null>(null);
  const [report, setReport] = useState<ResourceDoctorReport | null>(null);
  const [reportStatus, setReportStatus] = useState<"loading" | "ready" | "missing" | "error">(
    "loading",
  );
  const [message, setMessage] = useState<string | null>(null);

  async function loadActiveWorkspace() {
    const response = await fetch("/api/v1/workspaces/active");
    if (response.status === 404) {
      setActiveWorkspace(null);
      return;
    }
    if (!response.ok) {
      throw new Error("Failed to load active workspace");
    }
    setActiveWorkspace((await response.json()) as WorkspaceWithConfig);
  }

  async function loadReportFromApi() {
    setReportStatus("loading");
    const response = await fetch("/api/v1/reports/resource-doctor");
    if (response.status === 404) {
      setReport(null);
      setReportStatus("missing");
      return;
    }
    if (!response.ok) {
      throw new Error("Failed to load report");
    }
    const data = (await response.json()) as ResourceDoctorReport;
    setReport(data);
    setReportStatus("ready");
  }

  useEffect(() => {
    Promise.all([loadActiveWorkspace(), loadReportFromApi()]).catch(() => setReportStatus("error"));
  }, []);

  async function refreshReportFromDisk() {
    setMessage(null);
    setReportStatus("loading");
    const response = await fetch("/api/v1/reports/resource-doctor/load", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (response.status === 404) {
      setReport(null);
      setReportStatus("missing");
      return;
    }
    if (!response.ok) {
      throw new Error("Failed to refresh report");
    }
    await loadReportFromApi();
  }

  async function validateActiveWorkspace() {
    setMessage(null);
    const response = await fetch("/api/v1/workspaces/active/validate", { method: "POST" });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.message ?? "Validation failed");
      return;
    }
    setMessage(
      `Validated ${payload.summary.resourcesScanned} resources (${payload.summary.errors} errors)`,
    );
    await loadReportFromApi();
  }

  async function importReportFromFile(file: File) {
    const text = await file.text();
    const payload = JSON.parse(text) as ResourceDoctorReport;

    const response = await fetch("/api/v1/reports/resource-doctor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("Import failed");
    }

    setReport(payload);
    setReportStatus("ready");
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-[#111831] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Resource Report</h2>
            <p className="mt-1 text-sm text-slate-400">
              Reports load from the active workspace&apos;s{" "}
              <code className="rounded bg-white/5 px-1.5 py-0.5">.fdt/reports/resource-doctor.json</code>
            </p>
            {activeWorkspace && (
              <p className="mt-2 font-mono text-xs text-cyan-200">{activeWorkspace.directory}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => validateActiveWorkspace().catch(() => setMessage("Validation failed"))}
              className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-500/30"
            >
              Run validation
            </button>
            <button
              type="button"
              onClick={() => refreshReportFromDisk().catch(() => setReportStatus("error"))}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm text-slate-100 hover:bg-white/15"
            >
              Refresh from disk
            </button>
            <label className="cursor-pointer rounded-lg bg-white/10 px-4 py-2 text-sm text-slate-100 hover:bg-white/15">
              Import JSON
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    importReportFromFile(file).catch(() => setReportStatus("error"));
                  }
                }}
              />
            </label>
          </div>
        </div>

        {message && <p className="mt-4 text-sm text-cyan-200">{message}</p>}

        {!activeWorkspace && (
          <p className="mt-4 text-sm text-amber-300">
            No active workspace selected. Create or select one on the Workspaces page.
          </p>
        )}

        {reportStatus === "missing" && activeWorkspace && (
          <p className="mt-4 text-sm text-slate-400">
            No report found for the active workspace yet. Click Run validation or refresh after running
            the CLI against{" "}
            <code className="rounded bg-white/5 px-1.5 py-0.5">{activeWorkspace.directory}</code>
          </p>
        )}

        {reportStatus === "error" && (
          <p className="mt-4 text-sm text-rose-300">Failed to load or import the report.</p>
        )}

        {report && reportStatus === "ready" && (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-4">
              {[
                ["Scanned", report.summary.resourcesScanned],
                ["Errors", report.summary.errors],
                ["Warnings", report.summary.warnings],
                ["Passed", report.summary.passed],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/10 bg-[#0b1020] p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
                  <p className="mt-2 text-2xl font-semibold">{value}</p>
                </div>
              ))}
            </div>

            <p className="mt-4 text-xs text-slate-500">
              {report.workspaceName} · {new Date(report.generatedAt).toLocaleString()}
            </p>
          </>
        )}
      </div>

      {report && (
        <>
          <div className="rounded-2xl border border-white/10 bg-[#111831] p-6">
            <h3 className="font-medium">Findings</h3>
            <div className="mt-4 space-y-3">
              {report.findings.length === 0 && (
                <p className="text-sm text-slate-400">No findings reported.</p>
              )}
              {report.findings.map((finding) => (
                <article
                  key={finding.id}
                  className="rounded-xl border border-white/10 bg-[#0b1020] p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs uppercase ${severityClass(finding.severity)}`}
                    >
                      {finding.severity}
                    </span>
                    <span className="text-xs text-slate-500">{finding.code}</span>
                    {finding.resource && (
                      <span className="text-xs text-cyan-300">{finding.resource}</span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-200">{finding.message}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#111831] p-6">
            <h3 className="font-medium">Resource Inventory</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-400">
                  <tr>
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Category</th>
                    <th className="pb-2">Path</th>
                  </tr>
                </thead>
                <tbody>
                  {report.resources.map((resource) => (
                    <tr key={resource.path} className="border-t border-white/5">
                      <td className="py-2 pr-4 font-medium">{resource.name}</td>
                      <td className="py-2 pr-4 text-slate-400">{resource.category ?? "—"}</td>
                      <td className="py-2 text-slate-400">{resource.path}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
