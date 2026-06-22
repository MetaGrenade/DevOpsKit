import { useEffect, useState } from "react";
import type { WorkspaceWithConfig } from "../types/api";

interface QaStep {
  id: string;
  type: string;
  label: string;
  coords?: { x: number; y: number; z: number; heading?: number };
}

interface QaScenario {
  id: string;
  label: string;
  category: string;
  preconditions: string[];
  steps: QaStep[];
  expectedResults: string[];
}

interface QaStepResult {
  stepId: string;
  status: string;
  note?: string;
  updatedAt: string;
}

interface QaRun {
  id: string;
  scenarioId: string;
  scenarioLabel?: string;
  releaseId?: string;
  releaseVersion?: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  tester?: string;
  stepResults: QaStepResult[];
}

interface ReleaseOption {
  id: string;
  version: string;
}

const EMPTY_SCENARIO_FORM = {
  id: "",
  label: "",
  category: "general",
  stepLabel: "Verify basic behavior",
};

export default function QaPage() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceWithConfig | null>(null);
  const [scenarios, setScenarios] = useState<QaScenario[]>([]);
  const [runs, setRuns] = useState<QaRun[]>([]);
  const [releases, setReleases] = useState<ReleaseOption[]>([]);
  const [selectedRun, setSelectedRun] = useState<QaRun | null>(null);
  const [form, setForm] = useState(EMPTY_SCENARIO_FORM);
  const [importJson, setImportJson] = useState("");
  const [attachReleaseId, setAttachReleaseId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    setMessage(null);

    try {
      const wsRes = await fetch("/api/v1/workspaces/active");
      if (wsRes.status === 404) {
        setActiveWorkspace(null);
        setScenarios([]);
        setRuns([]);
        return;
      }
      if (!wsRes.ok) throw new Error("Failed to load active workspace");
      setActiveWorkspace((await wsRes.json()) as WorkspaceWithConfig);

      const [scenariosRes, runsRes, releasesRes] = await Promise.all([
        fetch("/api/v1/qa/scenarios"),
        fetch("/api/v1/qa/runs"),
        fetch("/api/v1/releases"),
      ]);

      if (scenariosRes.ok) {
        const data = (await scenariosRes.json()) as { scenarios: QaScenario[] };
        setScenarios(data.scenarios);
      }

      if (runsRes.ok) {
        const data = (await runsRes.json()) as { runs: QaRun[] };
        setRuns(data.runs);
        if (data.runs[0]) {
          setSelectedRun(data.runs[0]);
        }
      }

      if (releasesRes.ok) {
        const data = (await releasesRes.json()) as { releases: ReleaseOption[] };
        setReleases(data.releases.map((release) => ({ id: release.id, version: release.version })));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleSaveScenario(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    const scenarioId = form.id.trim();
    const payload: QaScenario = {
      id: scenarioId,
      label: form.label.trim() || scenarioId,
      category: form.category.trim() || "general",
      preconditions: [],
      steps: [
        {
          id: "step_1",
          type: "manual",
          label: form.stepLabel.trim() || "Manual verification step",
        },
      ],
      expectedResults: ["Scenario completes without errors"],
    };

    const response = await fetch("/api/v1/qa/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = (await response.json()) as { message?: string };
    if (!response.ok) {
      setMessage(result.message ?? "Failed to save scenario");
      return;
    }

    setForm(EMPTY_SCENARIO_FORM);
    setMessage(`Saved scenario ${scenarioId}`);
    await loadData();
  }

  async function handleDeleteScenario(id: string) {
    setMessage(null);
    const response = await fetch(`/api/v1/qa/scenarios/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const result = (await response.json()) as { message?: string };
      setMessage(result.message ?? "Failed to delete scenario");
      return;
    }

    setMessage(`Removed scenario ${id}`);
    await loadData();
  }

  async function handleImportRun() {
    setMessage(null);

    let payload: unknown;
    try {
      payload = JSON.parse(importJson);
    } catch {
      setMessage("Import JSON is invalid");
      return;
    }

    const response = await fetch("/api/v1/qa/runs/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = (await response.json()) as { message?: string; run?: QaRun };
    if (!response.ok) {
      setMessage(result.message ?? "Failed to import QA run");
      return;
    }

    setImportJson("");
    setMessage(`Imported run ${result.run?.id ?? ""}`);
    await loadData();
  }

  async function handleAttachRun() {
    if (!selectedRun || !attachReleaseId) return;
    setMessage(null);

    const release = releases.find((item) => item.id === attachReleaseId);
    const response = await fetch(
      `/api/v1/qa/runs/${encodeURIComponent(selectedRun.id)}/release`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          releaseId: attachReleaseId,
          releaseVersion: release?.version,
        }),
      },
    );

    const result = (await response.json()) as { message?: string; run?: QaRun };
    if (!response.ok) {
      setMessage(result.message ?? "Failed to attach run to release");
      return;
    }

    setMessage(`Attached run to release ${release?.version ?? attachReleaseId}`);
    await loadData();
    if (result.run) {
      setSelectedRun(result.run);
    }
  }

  function statusClass(status: string): string {
    switch (status) {
      case "completed":
        return "text-emerald-200 bg-emerald-500/15";
      case "failed":
        return "text-rose-200 bg-rose-500/15";
      case "in_progress":
        return "text-amber-200 bg-amber-500/15";
      default:
        return "text-slate-300 bg-slate-500/10";
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-400">Loading QA data…</p>;
  }

  if (!activeWorkspace) {
    return (
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <h2 className="text-xl font-semibold">QA Scenario Runner</h2>
        <p className="mt-2 text-sm text-slate-400">Select an active workspace to manage QA scenarios and runs.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <h2 className="text-xl font-semibold">QA Scenario Runner</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          Define reusable test scenarios in{" "}
          <code className="rounded bg-white/5 px-1.5 py-0.5">.fdt/qa/scenarios.json</code>, run them
          in-game with <code className="rounded bg-white/5 px-1.5 py-0.5">/fdt_qatest</code>, and import
          completed runs from the devtools export.
        </p>

        <div className="mt-4 rounded-xl border border-dashed border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-slate-300">
          <p className="font-medium text-cyan-200">Workflow</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-400">
            <li>
              Validate scenarios: <code className="text-slate-200">fdt qa validate</code>
            </li>
            <li>
              Export to devtools: <code className="text-slate-200">fdt qa export-scenarios</code>
            </li>
            <li>Run in-game and export the completed run to the dashboard</li>
            <li>Attach runs to a release candidate for sign-off</li>
          </ol>
        </div>

        {message && (
          <p className="mt-4 rounded-lg border border-white/10 bg-[#0b1020] px-4 py-2 text-sm text-slate-200">
            {message}
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
          <h3 className="font-semibold">Add Scenario</h3>
          <form className="mt-4 space-y-3 text-sm" onSubmit={handleSaveScenario}>
            <label className="block">
              <span className="text-slate-400">ID</span>
              <input
                required
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                placeholder="inventory-open-test"
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-slate-400">Label</span>
              <input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-slate-400">Category</span>
              <input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-cyan-500/20 px-4 py-2 font-medium text-cyan-200 hover:bg-cyan-500/30"
            >
              Save scenario
            </button>
          </form>

          <h3 className="mt-8 font-semibold">Scenarios ({scenarios.length})</h3>
          <div className="mt-3 space-y-2">
            {scenarios.length === 0 ? (
              <p className="text-sm text-slate-400">No scenarios yet.</p>
            ) : (
              scenarios.map((scenario) => (
                <article
                  key={scenario.id}
                  className="rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2 text-sm"
                >
                  <div className="font-medium">{scenario.label}</div>
                  <div className="text-xs text-slate-500">
                    {scenario.id} · {scenario.steps.length} steps
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDeleteScenario(scenario.id)}
                    className="mt-2 text-xs text-rose-300 hover:text-rose-200"
                  >
                    Delete
                  </button>
                </article>
              ))
            )}
          </div>

          <h3 className="mt-8 font-semibold">Import Run</h3>
          <textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            rows={6}
            placeholder='Paste QaRunExport JSON from in-game export'
            className="mt-2 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2 text-xs"
          />
          <button
            type="button"
            onClick={() => void handleImportRun()}
            className="mt-2 rounded-lg bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/25"
          >
            Import run
          </button>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
          <h3 className="font-semibold">QA Runs ({runs.length})</h3>
          <div className="mt-3 space-y-2">
            {runs.length === 0 ? (
              <p className="text-sm text-slate-400">No runs imported yet. Use /fdt_qatest in-game.</p>
            ) : (
              runs.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => setSelectedRun(run)}
                  className={`block w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    selectedRun?.id === run.id
                      ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-100"
                      : "border-white/10 bg-[#0b1020] text-slate-300 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{run.scenarioLabel ?? run.scenarioId}</span>
                    <span className={`rounded px-2 py-0.5 text-xs ${statusClass(run.status)}`}>
                      {run.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {run.id} · {new Date(run.startedAt).toLocaleString()}
                  </div>
                </button>
              ))
            )}
          </div>

          {selectedRun && (
            <div className="mt-6 rounded-xl border border-white/10 bg-[#0b1020] p-4">
              <h4 className="font-medium">{selectedRun.scenarioLabel ?? selectedRun.scenarioId}</h4>
              <p className="mt-1 text-sm text-slate-400">
                Run {selectedRun.id}
                {selectedRun.releaseVersion ? ` · Release ${selectedRun.releaseVersion}` : ""}
              </p>

              <ul className="mt-4 space-y-2 text-sm">
                {selectedRun.stepResults.map((step) => (
                  <li key={step.stepId} className="rounded-lg bg-[#111831] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span>{step.stepId}</span>
                      <span className={`rounded px-2 py-0.5 text-xs ${statusClass(step.status)}`}>
                        {step.status}
                      </span>
                    </div>
                    {step.note && <p className="mt-1 text-xs text-slate-500">{step.note}</p>}
                  </li>
                ))}
              </ul>

              {releases.length > 0 && (
                <div className="mt-4 flex flex-wrap items-end gap-2">
                  <label className="text-sm">
                    <span className="text-slate-400">Attach to release</span>
                    <select
                      value={attachReleaseId}
                      onChange={(e) => setAttachReleaseId(e.target.value)}
                      className="mt-1 block rounded-lg border border-white/10 bg-[#111831] px-3 py-2"
                    >
                      <option value="">Select release…</option>
                      {releases.map((release) => (
                        <option key={release.id} value={release.id}>
                          {release.version}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={!attachReleaseId}
                    onClick={() => void handleAttachRun()}
                    className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-40"
                  >
                    Attach
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
