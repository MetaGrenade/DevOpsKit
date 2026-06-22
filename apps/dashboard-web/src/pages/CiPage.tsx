import { useEffect, useState } from "react";
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

function statusClass(status: string): string {
  switch (status) {
    case "passed":
      return "text-emerald-200 bg-emerald-500/15";
    case "failed":
      return "text-rose-200 bg-rose-500/15";
    case "warn":
      return "text-amber-200 bg-amber-500/15";
    default:
      return "text-slate-300 bg-slate-500/10";
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
    return <p className="text-sm text-slate-400">Loading CI pipeline report…</p>;
  }

  if (!activeWorkspace) {
    return (
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <h2 className="text-xl font-semibold">CI / CD Integration</h2>
        <p className="mt-2 text-sm text-slate-400">Select an active workspace to view CI gate results.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <h2 className="text-xl font-semibold">CI / CD Integration</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          Run the same validation, security, and QA gates locally or in GitHub Actions with{" "}
          <code className="rounded bg-white/5 px-1.5 py-0.5">fdt ci run</code>. Reports are written to{" "}
          <code className="rounded bg-white/5 px-1.5 py-0.5">.fdt/reports/ci-pipeline.json</code>.
        </p>

        <div className="mt-4 rounded-xl border border-dashed border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-slate-300">
          <p className="font-medium text-cyan-200">Default gates</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-400">
            <li>
              <code className="text-slate-200">validate</code> — resource doctor (report-only by default in sample CI)
            </li>
            <li>
              <code className="text-slate-200">security</code> — blocks on new critical findings when a baseline exists
            </li>
            <li>
              <code className="text-slate-200">qa</code> — scenario schema validation
            </li>
            <li>
              <code className="text-slate-200">clothing</code> — auto-discover packs, scan stream folders, and
              validate slot conflicts (blocking when errors are found)
            </li>
          </ul>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={running}
            onClick={() => void runPipeline()}
            className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-50"
          >
            {running ? "Running…" : "Run CI pipeline"}
          </button>
        </div>

        {message && (
          <p className="mt-4 rounded-lg border border-white/10 bg-[#0b1020] px-4 py-2 text-sm text-slate-200">
            {message}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
        {report ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">
                  Pipeline {report.passed ? "passed" : "failed"}
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  {new Date(report.generatedAt).toLocaleString()}
                  {reportPath ? ` · ${reportPath}` : ""}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  report.passed ? "bg-emerald-500/15 text-emerald-200" : "bg-rose-500/15 text-rose-200"
                }`}
              >
                {report.passed ? "passed" : "failed"}
              </span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {report.gates.map((gate) => (
                <article key={gate.id} className="rounded-xl border border-white/10 bg-[#0b1020] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-medium capitalize">{gate.id}</h4>
                    <span className={`rounded px-2 py-0.5 text-xs ${statusClass(gate.status)}`}>
                      {gate.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {gate.blocking ? "Blocking gate" : "Report-only gate"}
                  </p>
                  {gate.message && <p className="mt-2 text-sm text-slate-400">{gate.message}</p>}
                  <pre className="mt-3 overflow-x-auto rounded-lg bg-[#111831] p-3 text-xs text-slate-400">
                    {JSON.stringify(gate.summary, null, 2)}
                  </pre>
                </article>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-400">
            No CI pipeline report yet. Run the pipeline from this page or via{" "}
            <code className="text-slate-200">fdt ci run --workspace &lt;path&gt;</code>.
          </p>
        )}
      </section>
    </div>
  );
}
