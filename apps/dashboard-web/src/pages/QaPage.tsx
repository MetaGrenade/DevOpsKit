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

  function runStatusClass(status: string): string {
    switch (status) {
      case "completed":
        return "finding-badge finding-badge-info path-ok";
      case "failed":
        return "finding-badge finding-badge-error";
      case "in_progress":
        return "finding-badge finding-badge-warning";
      default:
        return "finding-badge finding-badge-info";
    }
  }

  if (loading) {
    return (
      <PageStack>
        <p className="panel-subtext">Loading QA data…</p>
      </PageStack>
    );
  }

  if (!activeWorkspace) {
    return (
      <PageStack>
        <EmptyState
          title="QA Scenario Runner"
          description="Select an active workspace to manage QA scenarios and runs."
        />
      </PageStack>
    );
  }

  return (
    <PageStack>
      <PageIntro
        title="QA Scenario Runner"
        description={
          <>
            Define reusable test scenarios in <code className="inline-code">.fdt/qa/scenarios.json</code>,
            run them in-game with <code className="inline-code">/fdt_qatest</code>, and import completed runs
            from the devtools export.
          </>
        }
      />

      <NotePanel title="Workflow">
        <ol>
          <li>
            Validate scenarios: <code>fdt qa validate</code>
          </li>
          <li>
            Export to devtools: <code>fdt qa export-scenarios</code>
          </li>
          <li>Run in-game and export the completed run to the dashboard</li>
          <li>Attach runs to a release candidate for sign-off</li>
        </ol>
      </NotePanel>

      {message && <PageAlert>{message}</PageAlert>}

      <div className="page-grid-2">
        <Panel className="panel-compact">
          <h3 className="panel-heading">Add Scenario</h3>
          <form className="form-stack panel-section" onSubmit={handleSaveScenario}>
            <label className="form-field">
              <span className="form-label">ID</span>
              <input
                required
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                placeholder="inventory-open-test"
                className="form-control"
              />
            </label>
            <label className="form-field">
              <span className="form-label">Label</span>
              <input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className="form-control"
              />
            </label>
            <label className="form-field">
              <span className="form-label">Category</span>
              <input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="form-control"
              />
            </label>
            <button type="submit" className="btn btn-accent btn-sm">
              Save scenario
            </button>
          </form>

          <h3 className="panel-heading panel-section">Scenarios ({scenarios.length})</h3>
          <div className="panel-section space-y-2">
            {scenarios.length === 0 ? (
              <p className="panel-subtext">No scenarios yet.</p>
            ) : (
              scenarios.map((scenario) => (
                <article key={scenario.id} className="finding-card">
                  <div className="font-medium">{scenario.label}</div>
                  <div className="text-xs text-[var(--color-muted)]">
                    {scenario.id} · {scenario.steps.length} steps
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDeleteScenario(scenario.id)}
                    className="btn btn-secondary btn-sm mt-2"
                  >
                    Delete
                  </button>
                </article>
              ))
            )}
          </div>

          <h3 className="panel-heading panel-section">Import Run</h3>
          <textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            rows={6}
            placeholder="Paste QaRunExport JSON from in-game export"
            className="form-control form-control-mono panel-section"
          />
          <button
            type="button"
            onClick={() => void handleImportRun()}
            className="btn btn-primary btn-sm"
          >
            Import run
          </button>
        </Panel>

        <Panel className="panel-compact">
          <h3 className="panel-heading">QA Runs ({runs.length})</h3>
          <div className="panel-section space-y-2">
            {runs.length === 0 ? (
              <p className="panel-subtext">No runs imported yet. Use /fdt_qatest in-game.</p>
            ) : (
              runs.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => setSelectedRun(run)}
                  className={`browse-item w-full ${
                    selectedRun?.id === run.id ? "workspace-card-active" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{run.scenarioLabel ?? run.scenarioId}</span>
                      <span className={`text-xs ${runStatusClass(run.status)}`}>{run.status}</span>
                    </div>
                    <div className="text-xs text-[var(--color-muted)]">
                      {run.id} · {new Date(run.startedAt).toLocaleString()}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {selectedRun && (
            <div className="panel-section finding-card">
              <h4 className="font-medium">{selectedRun.scenarioLabel ?? selectedRun.scenarioId}</h4>
              <p className="panel-subtext">
                Run {selectedRun.id}
                {selectedRun.releaseVersion ? ` · Release ${selectedRun.releaseVersion}` : ""}
              </p>

              <ul className="list-plain panel-section text-sm">
                {selectedRun.stepResults.map((step) => (
                  <li key={step.stepId} className="finding-card">
                    <div className="flex items-center justify-between gap-2">
                      <span>{step.stepId}</span>
                      <span className={`text-xs ${runStatusClass(step.status)}`}>{step.status}</span>
                    </div>
                    {step.note && <p className="mt-1 text-xs text-[var(--color-muted)]">{step.note}</p>}
                  </li>
                ))}
              </ul>

              {releases.length > 0 && (
                <div className="btn-row">
                  <label className="form-field flex-1">
                    <span className="form-label">Attach to release</span>
                    <select
                      value={attachReleaseId}
                      onChange={(e) => setAttachReleaseId(e.target.value)}
                      className="form-control"
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
                    className="btn btn-accent btn-sm self-end"
                  >
                    Attach
                  </button>
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>
    </PageStack>
  );
}
