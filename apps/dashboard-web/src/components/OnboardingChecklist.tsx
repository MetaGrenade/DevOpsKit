import { useEffect, useState } from "react";
import type { PageId } from "../navigation";
import Panel from "./ui/Panel";

interface OnboardingStep {
  id: string;
  label: string;
  description: string;
  complete: boolean;
  page: string;
}

interface OnboardingStatus {
  complete: number;
  total: number;
  steps: OnboardingStep[];
}

export default function OnboardingChecklist({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);

  useEffect(() => {
    fetch("/api/v1/onboarding/status")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setStatus(data as OnboardingStatus | null))
      .catch(() => setStatus(null));
  }, []);

  if (!status || status.complete >= status.total) {
    return null;
  }

  const progress = Math.round((status.complete / status.total) * 100);

  return (
    <Panel className="panel-compact">
      <div className="onboarding-head">
        <div>
          <p className="panel-label">Onboarding</p>
          <h3 className="panel-heading">Complete your workspace setup</h3>
          <p className="panel-subtext">
            {status.complete} of {status.total} steps done · {progress}% complete
          </p>
        </div>
        <div className="onboarding-progress-ring" aria-hidden="true">
          <span>{progress}%</span>
        </div>
      </div>
      <div className="onboarding-progress">
        <div className="onboarding-progress-bar" style={{ width: `${progress}%` }} />
      </div>
      <ul className="onboarding-steps">
        {status.steps.map((step) => (
          <li key={step.id} className={`onboarding-step ${step.complete ? "onboarding-step-done" : ""}`}>
            <span className="onboarding-step-marker" aria-hidden="true">
              {step.complete ? "✓" : "○"}
            </span>
            <div className="onboarding-step-copy">
              <p className="onboarding-step-label">{step.label}</p>
              <p className="onboarding-step-desc">{step.description}</p>
            </div>
            {!step.complete && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onNavigate(step.page as PageId)}
              >
                Open
              </button>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
