import { useEffect, useState } from "react";
import {
  EmptyState,
  NotePanel,
  PageAlert,
  PageIntro,
  PageStack,
  Panel,
} from "../components/ui/page";
import type { WorkspaceWithConfig } from "../types/api";

interface CiGateResult {
  id: string;
  status: string;
  blocking: boolean;
  reportPath?: string;
  summary: Record<string, number | string | boolean>;
  message?: string;
}

interface CiPipelineReport {
  schemaVersion: number;
  generatedAt: string;
  workspaceName: string;
  workspaceRoot: string;
  passed: boolean;
  gates: CiGateResult[];
}

function gateStatusClass(status: string): string {
  switch (status) {
    case "passed":
      return "finding-badge finding-badge-info path-ok";
    case "failed":
      return "finding-badge finding-badge-error";
    case "warn":
      return "finding-badge finding-badge-warning";
    default:
      return "finding-badge finding-badge-info";
  }
}

export default function CiPage() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceWithConfig | null>(null);
  const [report, setReport] = useState<CiPipelineReport | null>(null);
  const [reportPath, setReportPath] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

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

    const reportRes = await fetch("/api/v1/reports/ci-pipeline");
    if (reportRes.status === 404) {
      setReport(null);
      setReportPath(null);
      setStatus("missing");
      return;
    }
    if (!reportRes.ok) {
      setStatus("error");
      setMessage("Failed to load CI pipeline report");
      return;
    }

    const payload = (await reportRes.json()) as { report: CiPipelineReport; reportPath: string };
    setReport(payload.report);
    setReportPath(payload.reportPath);
    setStatus("ready");
  }

  useEffect(() => {
    void loadReport();
  }, []);

  async function runPipeline() {
    setRunning(true);
    setMessage(null);

    const response = await fetch("/api/v1/workspaces/active/ci-run", { method: "POST" });
    const payload = (await response.json()) as {
      message?: string;
      passed?: boolean;
      status?: string;
    };

    if (!response.ok) {
      setMessage(payload.message ?? "CI pipeline run failed");
      setRunning(false);
      return;
    }

    setMessage(`CI pipeline ${payload.passed ? "passed" : "failed"}`);
    await loadReport();
    setRunning(false);
  }

  if (status === "loading") {
    return (
      <PageStack>
        <p className="panel-subtext">Loading CI pipeline report…</p>
      </PageStack>
    );
  }

  if (!activeWorkspace) {
    return (
      <PageStack>
        <EmptyState
          title="CI / CD Integration"
          description="Select an active workspace to view CI gate results."
        />
      </PageStack>
    );
  }

  return (
    <PageStack>
      <PageIntro
        title="CI / CD Integration"
        description={
          <>
            Run the same validation, security, and QA gates locally or in GitHub Actions with{" "}
            <code className="inline-code">fdt ci run</code>. Reports are written to{" "}
            <code className="inline-code">.fdt/reports/ci-pipeline.json</code>.
          </>
        }
        actions={
          <button
            type="button"
            disabled={running}
            onClick={() => void runPipeline()}
            className="btn btn-accent btn-sm"
          >
            {running ? "Running…" : "Run CI pipeline"}
          </button>
        }
      />

      <NotePanel title="Default gates">
        <ul>
          <li>
            <code>validate</code> — resource doctor (report-only by default in sample CI)
          </li>
          <li>
            <code>security</code> — blocks on new critical findings when a baseline exists
          </li>
          <li>
            <code>qa</code> — scenario schema validation
          </li>
          <li>
            <code>clothing</code> — auto-discover packs, scan stream folders, and validate slot conflicts
            (blocking when errors are found)
          </li>
        </ul>
      </NotePanel>

      {message && <PageAlert>{message}</PageAlert>}

      <Panel className="panel-compact">
        {report ? (
          <>
            <div className="workspace-card-head">
              <div>
                <h3 className="panel-heading">Pipeline {report.passed ? "passed" : "failed"}</h3>
                <p className="panel-subtext">
                  {new Date(report.generatedAt).toLocaleString()}
                  {reportPath ? ` · ${reportPath}` : ""}
                </p>
              </div>
              <span className={`status-pill ${report.passed ? "status-pill-active path-ok" : "finding-badge-error"}`}>
                {report.passed ? "passed" : "failed"}
              </span>
            </div>

            <div className="page-grid-2 panel-section">
              {report.gates.map((gate) => (
                <article key={gate.id} className="finding-card">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-medium capitalize">{gate.id}</h4>
                    <span className={`text-xs ${gateStatusClass(gate.status)}`}>{gate.status}</span>
                  </div>
                  <p className="mt-2 text-xs text-[var(--color-muted)]">
                    {gate.blocking ? "Blocking gate" : "Report-only gate"}
                  </p>
                  {gate.message && <p className="mt-2 text-sm text-[var(--color-muted)]">{gate.message}</p>}
                  <pre className="code-block mt-3">{JSON.stringify(gate.summary, null, 2)}</pre>
                </article>
              ))}
            </div>
          </>
        ) : (
          <p className="panel-subtext">
            No CI pipeline report yet. Run the pipeline from this page or via{" "}
            <code className="inline-code">fdt ci run --workspace &lt;path&gt;</code>.
          </p>
        )}
      </Panel>
    </PageStack>
  );
}
