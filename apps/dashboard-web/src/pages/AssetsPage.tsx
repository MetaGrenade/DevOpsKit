import { useEffect, useMemo, useState } from "react";
import {
  EmptyState,
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

const RANKING_COLUMNS: Array<DataTableColumn<ResourceSummary>> = [
  {
    key: "resource",
    header: "Resource",
    className: "text-[var(--color-accent-ink)]",
    render: (summary) => summary.resource,
  },
  { key: "assetCount", header: "Assets", align: "right", render: (summary) => summary.assetCount },
  { key: "totalMb", header: "Total MB", align: "right", render: (summary) => bytesToMb(summary.totalBytes) },
  { key: "ytdMb", header: "YTD MB", align: "right", render: (summary) => bytesToMb(summary.ytdBytes) },
];

export default function AssetsPage() {
  const { notify } = useToast();
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceWithConfig | null>(null);
  const [report, setReport] = useState<AssetAuditorReport | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [rankingFilter, setRankingFilter] = useState("");

  async function loadReport() {
    setStatus("loading");

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
    const response = await fetch("/api/v1/workspaces/active/audit-stream", { method: "POST" });
    const payload = await response.json();
    if (!response.ok) {
      notify({ title: "Audit failed", message: payload.message ?? undefined, tone: "error" });
      return;
    }
    notify({
      title: "Stream audit complete",
      message: `${payload.summary.assetsIndexed} assets · ${payload.summary.duplicateFileNames} duplicate filenames · ${payload.summary.warnings} warnings`,
      tone: payload.summary.warnings > 0 ? "warning" : "success",
    });
    await loadReport();
  }

  const filteredSummaries = useMemo(() => {
    if (!report) {
      return [];
    }
    const normalized = rankingFilter.trim().toLowerCase();
    const sorted = [...report.resourceSummaries].sort((a, b) => b.totalBytes - a.totalBytes);
    if (!normalized) {
      return sorted;
    }
    return sorted.filter((summary) => summary.resource.toLowerCase().includes(normalized));
  }, [report, rankingFilter]);

  if (status === "loading") {
    return (
      <PageStack>
        <Panel className="panel-compact">
          <SkeletonText lines={6} />
        </Panel>
      </PageStack>
    );
  }

  if (!activeWorkspace) {
    return (
      <PageStack>
        <EmptyState title="Asset Auditor" description="Select or register a workspace first." />
      </PageStack>
    );
  }

  return (
    <PageStack>
      <PageIntro
        title="Asset Auditor"
        description={
          <>
            Stream assets for{" "}
            <span className="text-[var(--color-accent-ink)]">{activeWorkspace.name}</span>
          </>
        }
        actions={
          <button type="button" onClick={() => void runAudit()} className="btn btn-accent btn-sm">
            Run stream audit
          </button>
        }
      />

      {status === "missing" && (
        <PageAlert variant="warning">
          No asset report yet. Run a stream audit or use{" "}
          <code className="inline-code">pnpm fdt audit stream</code>.
        </PageAlert>
      )}

      {report && (
        <>
          <StatGrid columns={4}>
            <StatTile label="Assets indexed" value={report.summary.assetsIndexed} />
            <StatTile
              label="Total stream size"
              value={`${bytesToMb(report.summary.totalBytes)} MB`}
            />
            <StatTile
              label="Duplicate filenames"
              value={report.summary.duplicateFileNames}
              tone="warning"
            />
            <StatTile label="Warnings" value={report.summary.warnings} tone="warning" />
          </StatGrid>

          {report.resourceSummaries.length > 0 && (
            <Panel className="panel-compact">
              <h3 className="panel-heading">Resource size ranking</h3>
              <div className="panel-section">
                <Toolbar
                  search={{
                    value: rankingFilter,
                    onChange: setRankingFilter,
                    placeholder: "Filter resources…",
                    ariaLabel: "Filter resource size ranking",
                  }}
                  count={`${filteredSummaries.length} of ${report.resourceSummaries.length}`}
                />
                <DataTable
                  columns={RANKING_COLUMNS}
                  rows={filteredSummaries}
                  getRowKey={(summary) => summary.resource}
                  emptyMessage="No resources match your filter."
                />
              </div>
            </Panel>
          )}

          {report.duplicateGroups.length > 0 && (
            <Panel className="panel-compact">
              <h3 className="panel-heading">Duplicate filenames</h3>
              <ul className="list-plain panel-section space-y-3">
                {report.duplicateGroups.map((group) => (
                  <li key={group.fileName} className="alert alert-warning">
                    <p className="font-medium">{group.fileName}</p>
                    <ul className="list-plain mt-2 text-sm">
                      {group.occurrences.map((occurrence) => (
                        <li key={occurrence.id}>
                          {occurrence.resource}/{occurrence.relativePath}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {report.findings.length > 0 && (
            <Panel className="panel-compact">
              <h3 className="panel-heading">Findings</h3>
              <ul className="list-plain panel-section space-y-2">
                {report.findings.map((finding) => (
                  <li key={finding.id} className={`finding-card ${findingBadgeClass(finding.severity)}`}>
                    {finding.resource ? `[${finding.resource}] ` : ""}
                    {finding.message}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </>
      )}
    </PageStack>
  );
}
