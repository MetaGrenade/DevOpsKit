import { useEffect, useMemo, useState } from "react";
import {
  PageAlert,
  PageIntro,
  PageStack,
  Panel,
  StatGrid,
  StatTile,
} from "../components/ui/page";
import { SkeletonText } from "../components/ui/primitives";
import DataTable, { type DataTableColumn } from "../components/ui/DataTable";
import Toolbar from "../components/ui/Toolbar";
import { useToast } from "../components/ui/Toast";
import type { WorkspaceWithConfig } from "../types/api";

interface Finding {
  id: string;
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  resource?: string;
}

interface ResourceInventoryItem {
  name: string;
  path: string;
  category?: string;
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
  resources: ResourceInventoryItem[];
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

const INVENTORY_COLUMNS: Array<DataTableColumn<ResourceInventoryItem>> = [
  {
    key: "name",
    header: "Name",
    className: "font-medium",
    render: (resource) => resource.name,
  },
  {
    key: "category",
    header: "Category",
    className: "text-[var(--color-muted)]",
    render: (resource) => resource.category ?? "—",
  },
  {
    key: "path",
    header: "Path",
    className: "text-[var(--color-muted)]",
    render: (resource) => resource.path,
  },
];

export default function ResourcesPage() {
  const { notify } = useToast();
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceWithConfig | null>(null);
  const [report, setReport] = useState<ResourceDoctorReport | null>(null);
  const [reportStatus, setReportStatus] = useState<"loading" | "ready" | "missing" | "error">(
    "loading",
  );
  const [inventoryFilter, setInventoryFilter] = useState("");

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
    notify({ title: "Report refreshed", message: "Loaded the latest report from disk.", tone: "success" });
  }

  async function validateActiveWorkspace() {
    const response = await fetch("/api/v1/workspaces/active/validate", { method: "POST" });
    const payload = await response.json();
    if (!response.ok) {
      notify({ title: "Validation failed", message: payload.message ?? undefined, tone: "error" });
      return;
    }
    notify({
      title: "Validation complete",
      message: `Scanned ${payload.summary.resourcesScanned} resources · ${payload.summary.errors} errors`,
      tone: payload.summary.errors > 0 ? "warning" : "success",
    });
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
    notify({ title: "Report imported", message: `${payload.resources.length} resources loaded.`, tone: "success" });
  }

  const filteredResources = useMemo(() => {
    if (!report) {
      return [];
    }
    const normalized = inventoryFilter.trim().toLowerCase();
    if (!normalized) {
      return report.resources;
    }
    return report.resources.filter((resource) =>
      [resource.name, resource.category ?? "", resource.path].join(" ").toLowerCase().includes(normalized),
    );
  }, [report, inventoryFilter]);

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
              onClick={() => validateActiveWorkspace().catch(() => notify({ title: "Validation failed", tone: "error" }))}
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
                    importReportFromFile(file).catch(() =>
                      notify({ title: "Import failed", message: "Could not parse the selected file.", tone: "error" }),
                    );
                  }
                }}
              />
            </label>
          </div>
        }
      />

      {!activeWorkspace && (
        <PageAlert variant="warning">
          No active workspace selected. Create or select one on the Workspaces page.
        </PageAlert>
      )}

      {reportStatus === "loading" && (
        <Panel className="panel-compact">
          <SkeletonText lines={6} />
        </Panel>
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
            <div className="panel-section">
              <Toolbar
                search={{
                  value: inventoryFilter,
                  onChange: setInventoryFilter,
                  placeholder: "Filter resources…",
                  ariaLabel: "Filter resource inventory",
                }}
                count={`${filteredResources.length} of ${report.resources.length}`}
              />
              <DataTable
                columns={INVENTORY_COLUMNS}
                rows={filteredResources}
                getRowKey={(resource) => resource.path}
                emptyMessage="No resources match your filter."
              />
            </div>
          </Panel>
        </>
      )}
    </PageStack>
  );
}
