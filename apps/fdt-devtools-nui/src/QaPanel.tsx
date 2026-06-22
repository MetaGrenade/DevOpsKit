import { useState } from "react";
import { nuiFetch } from "./nui";

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
}

interface QaRun {
  id: string;
  scenarioId: string;
  scenarioLabel?: string;
  status: string;
  stepResults: QaStepResult[];
}

interface QaPanelProps {
  scenarios: QaScenario[];
  activeScenario: QaScenario | null;
  activeRun: QaRun | null;
  status: string | null;
  exportPreview: string;
  onClose: () => void;
}

export default function QaPanel({
  scenarios,
  activeScenario,
  activeRun,
  status,
  exportPreview,
  onClose,
}: QaPanelProps) {
  const [note, setNote] = useState("");

  async function startRun(scenarioId: string) {
    await nuiFetch("qaStartRun", { scenarioId });
  }

  async function markStep(stepId: string, stepStatus: "passed" | "failed" | "skipped") {
    await nuiFetch("qaUpdateStep", { stepId, status: stepStatus, note: note.trim() || undefined });
    setNote("");
  }

  async function teleportStep(step: QaStep) {
    if (step.coords) {
      await nuiFetch("qaTeleportStep", { coords: step.coords });
    }
  }

  return (
    <>
      <button type="button" className="close-btn" onClick={() => void onClose()}>
        Close QA (Esc)
      </button>

      <div className="overlay">
        <section className="panel">
          <h2>FDT QA Runner</h2>
          <p className="status">Select a scenario and mark each step pass/fail.</p>

          <div className="zone-list">
            {scenarios.length === 0 ? (
              <p className="status">No scenarios loaded. Export from workspace with fdt qa export-scenarios.</p>
            ) : (
              scenarios.map((scenario) => (
                <article key={scenario.id} className="zone-card">
                  <strong>{scenario.label}</strong>
                  <div className="mono">{scenario.id}</div>
                  <div className="status">{scenario.category} · {scenario.steps.length} steps</div>
                  <button type="button" style={{ marginTop: 8 }} onClick={() => void startRun(scenario.id)}>
                    Start run
                  </button>
                </article>
              ))
            )}
          </div>

          {status && <p className="status">{status}</p>}
        </section>

        <section className="panel">
          <h3>{activeScenario?.label ?? "Active Run"}</h3>
          {activeRun ? (
            <>
              <p className="status">
                Run {activeRun.id} · {activeRun.status}
              </p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Optional step note"
                style={{ width: "100%", marginBottom: 8 }}
              />
              <div className="zone-list">
                {activeScenario?.steps.map((step) => {
                  const result = activeRun.stepResults.find((item) => item.stepId === step.id);
                  return (
                    <article key={step.id} className="zone-card">
                      <strong>{step.label}</strong>
                      <div className="status">
                        {step.type} · {result?.status ?? "pending"}
                      </div>
                      <div className="row" style={{ marginTop: 8 }}>
                        {step.type === "teleport" && step.coords && (
                          <button type="button" onClick={() => void teleportStep(step)}>
                            Teleport
                          </button>
                        )}
                        <button type="button" onClick={() => void markStep(step.id, "passed")}>
                          Pass
                        </button>
                        <button type="button" className="danger" onClick={() => void markStep(step.id, "failed")}>
                          Fail
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              <button type="button" style={{ marginTop: 12 }} onClick={() => void nuiFetch("qaExportRun")}>
                Export run to dashboard
              </button>
            </>
          ) : (
            <p className="status">Start a scenario to begin step tracking.</p>
          )}

          {exportPreview && (
            <>
              <h3 style={{ marginTop: 16 }}>Export Preview</h3>
              <textarea readOnly rows={8} value={exportPreview} style={{ width: "100%" }} />
            </>
          )}
        </section>
      </div>
    </>
  );
}
