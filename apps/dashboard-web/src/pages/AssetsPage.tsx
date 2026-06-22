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
    return (
      <PageStack>
        <p className="panel-subtext">Loading asset report…</p>
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

      {message && <PageAlert>{message}</PageAlert>}

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
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Resource</th>
                      <th>Assets</th>
                      <th>Total MB</th>
                      <th>YTD MB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.resourceSummaries.map((summary) => (
                      <tr key={summary.resource}>
                        <td className="text-[var(--color-accent-ink)]">{summary.resource}</td>
                        <td>{summary.assetCount}</td>
                        <td>{bytesToMb(summary.totalBytes)}</td>
                        <td>{bytesToMb(summary.ytdBytes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
