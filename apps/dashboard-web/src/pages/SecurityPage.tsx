import { useEffect, useMemo, useState } from "react";
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

function severityClass(severity: SecurityFinding["severity"]): string {
  switch (severity) {
    case "critical":
      return "text-rose-200 bg-rose-500/15";
    case "high":
      return "text-orange-200 bg-orange-500/15";
    case "medium":
      return "text-amber-200 bg-amber-500/15";
    case "low":
      return "text-cyan-200 bg-cyan-500/15";
    default:
      return "text-slate-300 bg-slate-500/10";
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
    return <p className="text-sm text-slate-400">Loading security report…</p>;
  }

  if (!activeWorkspace) {
    return (
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <h2 className="text-xl font-semibold">Security</h2>
        <p className="mt-2 text-sm text-slate-400">Select an active workspace to view security findings.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Security Auditor</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Lua pattern scanner for risky net events, reward handlers, dangerous functions, and SQL/HTTP
              concatenation. Reports stored at{" "}
              <code className="rounded bg-white/5 px-1.5 py-0.5">.fdt/reports/security-audit.json</code>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runScan()}
              className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/30"
            >
              Run scan
            </button>
            <button
              type="button"
              onClick={() => void createBaseline()}
              className="rounded-lg bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/25"
            >
              Save baseline
            </button>
            <button
              type="button"
              onClick={() => void loadReport()}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:border-white/20"
            >
              Refresh
            </button>
          </div>
        </div>

        {message && (
          <p className="mt-4 rounded-lg border border-white/10 bg-[#0b1020] px-4 py-2 text-sm text-slate-200">
            {message}
          </p>
        )}

        {status === "missing" && (
          <p className="mt-4 text-sm text-slate-400">
            No security report yet. Run a scan or use{" "}
            <code className="text-slate-200">fdt security scan --workspace {activeWorkspace.directory}</code>.
          </p>
        )}
      </section>

      {report && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Critical", report.summary.critical, report.summary.newCritical, "text-rose-300"],
              ["High", report.summary.high, report.summary.newHigh, "text-orange-300"],
              ["Medium", report.summary.medium, null, "text-amber-300"],
              ["Suppressed", report.summary.suppressed, null, "text-slate-300"],
            ].map(([label, total, fresh, color]) => (
              <article key={label as string} className="rounded-xl border border-white/10 bg-[#111831] p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">{label as string}</p>
                <p className={`mt-2 text-2xl font-semibold ${color as string}`}>{total as number}</p>
                {fresh !== null && (
                  <p className="mt-1 text-xs text-slate-400">{fresh as number} new since baseline</p>
                )}
              </article>
            ))}
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">Findings by resource</h3>
              <label className="flex items-center gap-2 text-sm text-slate-400">
                <input
                  type="checkbox"
                  checked={showSuppressed}
                  onChange={(e) => setShowSuppressed(e.target.checked)}
                />
                Show baseline-suppressed
              </label>
            </div>

            <div className="mt-4 space-y-6">
              {[...groupedFindings.entries()].map(([resource, findings]) => (
                <div key={resource}>
                  <h4 className="font-medium text-cyan-200">{resource}</h4>
                  <div className="mt-3 space-y-3">
                    {findings.map((finding) => (
                      <article
                        key={finding.id}
                        className={`rounded-xl border border-white/10 p-4 ${finding.suppressed ? "opacity-60" : ""}`}
                      >
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className={`rounded-full px-2 py-0.5 uppercase ${severityClass(finding.severity)}`}>
                            {finding.severity}
                          </span>
                          <span className="text-slate-500">{finding.category}</span>
                          <span className="font-mono text-slate-400">{finding.code}</span>
                          {finding.isNew && (
                            <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-rose-200">new</span>
                          )}
                          {finding.suppressed && (
                            <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-slate-300">
                              baseline
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm text-slate-200">{finding.message}</p>
                        {(finding.file || finding.line) && (
                          <p className="mt-1 font-mono text-xs text-slate-500">
                            {finding.file}
                            {finding.line ? `:${finding.line}` : ""}
                          </p>
                        )}
                        {finding.snippet && (
                          <pre className="mt-2 overflow-x-auto rounded-lg bg-[#0b1020] p-3 text-xs text-slate-300">
                            {finding.snippet}
                          </pre>
                        )}
                        {finding.remediation && (
                          <p className="mt-2 text-xs text-slate-400">{finding.remediation}</p>
                        )}
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
