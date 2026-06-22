import { useEffect, useState } from "react";
import {
  PageAlert,
  PageIntro,
  PageStack,
  Panel,
  StatGrid,
  StatTile,
} from "../components/ui/page";
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

function findingBadgeClass(severity: Finding["severity"]): string {
  switch (severity) {
    case "error":
      return "finding-badge finding-badge-error";
    case "warning":
      return "finding-badge finding-badge-warning";
    default:
      return "finding-badge finding-badge-info";
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
    <PageStack>
      <PageIntro
        title="Resource Report"
        description={
          <>
            Reports load from the active workspace&apos;s{" "}
            <code className="inline-code">.fdt/reports/resource-doctor.json</code>
            {activeWorkspace && (
              <>
                {" "}
                · <span className="font-mono text-[var(--color-accent-ink)]">{activeWorkspace.directory}</span>
              </>
            )}
          </>
        }
        actions={
          <div className="btn-row" style={{ marginTop: 0 }}>
            <button
              type="button"
              onClick={() => validateActiveWorkspace().catch(() => setMessage("Validation failed"))}
              className="btn btn-accent btn-sm"
            >
              Run validation
            </button>
            <button
              type="button"
              onClick={() => refreshReportFromDisk().catch(() => setReportStatus("error"))}
              className="btn btn-secondary btn-sm"
            >
              Refresh from disk
            </button>
            <label className="btn btn-secondary btn-sm cursor-pointer">
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
        }
      />

      {message && <PageAlert>{message}</PageAlert>}

      {!activeWorkspace && (
        <PageAlert variant="warning">
          No active workspace selected. Create or select one on the Workspaces page.
        </PageAlert>
      )}

      {reportStatus === "missing" && activeWorkspace && (
        <PageAlert variant="warning">
          No report found for the active workspace yet. Click Run validation or refresh after running the CLI
          against <code className="inline-code">{activeWorkspace.directory}</code>
        </PageAlert>
      )}

      {reportStatus === "error" && (
        <PageAlert variant="error">Failed to load or import the report.</PageAlert>
      )}

      {report && reportStatus === "ready" && (
        <>
          <StatGrid columns={4}>
            <StatTile label="Scanned" value={report.summary.resourcesScanned} />
            <StatTile label="Errors" value={report.summary.errors} tone="danger" />
            <StatTile label="Warnings" value={report.summary.warnings} tone="warning" />
            <StatTile label="Passed" value={report.summary.passed} tone="success" />
          </StatGrid>

          <p className="panel-subtext">
            {report.workspaceName} · {new Date(report.generatedAt).toLocaleString()}
          </p>

          <Panel className="panel-compact">
            <h3 className="panel-heading">Findings</h3>
            <div className="panel-section space-y-3">
              {report.findings.length === 0 && (
                <p className="panel-subtext">No findings reported.</p>
              )}
              {report.findings.map((finding) => (
                <article key={finding.id} className="finding-card">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={findingBadgeClass(finding.severity)}>{finding.severity}</span>
                    <span className="text-xs text-[var(--color-muted)]">{finding.code}</span>
                    {finding.resource && (
                      <span className="text-xs text-[var(--color-accent-ink)]">{finding.resource}</span>
                    )}
                  </div>
                  <p className="mt-2 text-sm">{finding.message}</p>
                </article>
              ))}
            </div>
          </Panel>

          <Panel className="panel-compact">
            <h3 className="panel-heading">Resource Inventory</h3>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Path</th>
                  </tr>
                </thead>
                <tbody>
                  {report.resources.map((resource) => (
                    <tr key={resource.path}>
                      <td className="font-medium">{resource.name}</td>
                      <td className="text-[var(--color-muted)]">{resource.category ?? "—"}</td>
                      <td className="text-[var(--color-muted)]">{resource.path}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </PageStack>
  );
}
