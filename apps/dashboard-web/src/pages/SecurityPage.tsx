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
import type { WorkspaceWithConfig } from "../types/api";

interface SecurityFinding {
  id: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  confidence: string;
  category: string;
  code: string;
  message: string;
  resource?: string;
  file?: string;
  line?: number;
  snippet?: string;
  remediation?: string;
  suppressed?: boolean;
  isNew?: boolean;
}

interface SecurityReport {
  workspaceName: string;
  generatedAt: string;
  summary: {
    resourcesScanned: number;
    luaFilesScanned: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    suppressed: number;
    newFindings: number;
    newCritical: number;
    newHigh: number;
  };
  findings: SecurityFinding[];
}

function severityBadgeClass(severity: SecurityFinding["severity"]): string {
  switch (severity) {
    case "critical":
      return "finding-badge finding-badge-error";
    case "high":
      return "finding-badge finding-badge-warning";
    case "medium":
      return "finding-badge finding-badge-warning";
    case "low":
      return "finding-badge finding-badge-info";
    default:
      return "finding-badge finding-badge-info";
  }
}

export default function SecurityPage() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceWithConfig | null>(null);
  const [report, setReport] = useState<SecurityReport | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [showSuppressed, setShowSuppressed] = useState(false);

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
    if (!wsRes.ok) {
      setStatus("error");
      setMessage("Failed to load active workspace");
      return;
    }
    setActiveWorkspace((await wsRes.json()) as WorkspaceWithConfig);

    const reportRes = await fetch("/api/v1/reports/security-audit");
    if (reportRes.status === 404) {
      setReport(null);
      setStatus("missing");
      return;
    }
    if (!reportRes.ok) {
      setStatus("error");
      setMessage("Failed to load security report");
      return;
    }

    setReport((await reportRes.json()) as SecurityReport);
    setStatus("ready");
  }

  useEffect(() => {
    void loadReport();
  }, []);

  async function runScan() {
    setMessage(null);
    const response = await fetch("/api/v1/workspaces/active/security-scan", { method: "POST" });
    const payload = (await response.json()) as { message?: string; summary?: SecurityReport["summary"] };

    if (!response.ok) {
      setMessage(payload.message ?? "Security scan failed");
      return;
    }

    setMessage(
      `Scan complete — ${payload.summary?.newCritical ?? 0} new critical, ${payload.summary?.newHigh ?? 0} new high`,
    );
    await loadReport();
  }

  async function createBaseline() {
    setMessage(null);
    const response = await fetch("/api/v1/workspaces/active/security-baseline", { method: "POST" });
    const payload = (await response.json()) as { message?: string; fingerprintCount?: number };

    if (!response.ok) {
      setMessage(payload.message ?? "Failed to create baseline");
      return;
    }

    setMessage(`Baseline saved (${payload.fingerprintCount ?? 0} fingerprints)`);
    await loadReport();
  }

  const groupedFindings = useMemo(() => {
    if (!report) return new Map<string, SecurityFinding[]>();

    const filtered = report.findings.filter((finding) => showSuppressed || !finding.suppressed);
    const groups = new Map<string, SecurityFinding[]>();

    for (const finding of filtered) {
      const key = finding.resource ?? "unknown";
      const list = groups.get(key) ?? [];
      list.push(finding);
      groups.set(key, list);
    }

    return groups;
  }, [report, showSuppressed]);

  if (status === "loading") {
    return (
      <PageStack>
        <p className="panel-subtext">Loading security report…</p>
      </PageStack>
    );
  }

  if (!activeWorkspace) {
    return (
      <PageStack>
        <EmptyState title="Security" description="Select an active workspace to view security findings." variant="workspace" />
      </PageStack>
    );
  }

  return (
    <PageStack>
      <PageIntro
        title="Security Auditor"
        description={
          <>
            Lua pattern scanner for risky net events, reward handlers, dangerous functions, and SQL/HTTP
            concatenation. Reports stored at{" "}
            <code className="inline-code">.fdt/reports/security-audit.json</code>.
          </>
        }
        actions={
          <div className="btn-row" style={{ marginTop: 0 }}>
            <button type="button" onClick={() => void runScan()} className="btn btn-accent btn-sm">
              Run scan
            </button>
            <button type="button" onClick={() => void createBaseline()} className="btn btn-secondary btn-sm">
              Save baseline
            </button>
            <button type="button" onClick={() => void loadReport()} className="btn btn-secondary btn-sm">
              Refresh
            </button>
          </div>
        }
      />

      {message && <PageAlert>{message}</PageAlert>}

      {status === "missing" && (
        <PageAlert variant="warning">
          No security report yet. Run a scan or use{" "}
          <code className="inline-code">fdt security scan --workspace {activeWorkspace.directory}</code>.
        </PageAlert>
      )}

      {report && (
        <>
          <StatGrid columns={4}>
            <StatTile
              label="Critical"
              value={report.summary.critical}
              hint={`${report.summary.newCritical} new since baseline`}
              tone="danger"
            />
            <StatTile
              label="High"
              value={report.summary.high}
              hint={`${report.summary.newHigh} new since baseline`}
              tone="warning"
            />
            <StatTile label="Medium" value={report.summary.medium} tone="warning" />
            <StatTile label="Suppressed" value={report.summary.suppressed} tone="muted" />
          </StatGrid>

          <Panel className="panel-compact">
            <div className="workspace-card-head">
              <h3 className="panel-heading">Findings by resource</h3>
              <label className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
                <input
                  type="checkbox"
                  checked={showSuppressed}
                  onChange={(e) => setShowSuppressed(e.target.checked)}
                />
                Show baseline-suppressed
              </label>
            </div>

            <div className="panel-section space-y-5">
              {[...groupedFindings.entries()].map(([resource, findings]) => (
                <div key={resource}>
                  <h4 className="font-medium text-[var(--color-accent-ink)]">{resource}</h4>
                  <div className="mt-3 space-y-3">
                    {findings.map((finding) => (
                      <article
                        key={finding.id}
                        className={`finding-card ${finding.suppressed ? "finding-card-muted" : ""}`}
                      >
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className={severityBadgeClass(finding.severity)}>{finding.severity}</span>
                          <span className="text-[var(--color-muted)]">{finding.category}</span>
                          <span className="font-mono text-[var(--color-muted)]">{finding.code}</span>
                          {finding.isNew && (
                            <span className="finding-badge finding-badge-error">new</span>
                          )}
                          {finding.suppressed && (
                            <span className="finding-badge finding-badge-info">baseline</span>
                          )}
                        </div>
                        <p className="mt-2 text-sm">{finding.message}</p>
                        {(finding.file || finding.line) && (
                          <p className="mt-1 font-mono text-xs text-[var(--color-muted)]">
                            {finding.file}
                            {finding.line ? `:${finding.line}` : ""}
                          </p>
                        )}
                        {finding.snippet && <pre className="code-block mt-2">{finding.snippet}</pre>}
                        {finding.remediation && (
                          <p className="mt-2 text-xs text-[var(--color-muted)]">{finding.remediation}</p>
                        )}
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </PageStack>
  );
}
