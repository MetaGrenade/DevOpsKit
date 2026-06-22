import { useEffect, useState } from "react";
import Panel, { PageIntro } from "../components/ui/Panel";
import type { WorkspaceWithConfig } from "../types/api";

interface EnvironmentConvar {
  key: string;
  value: string;
}

interface EnvironmentProfile {
  id: string;
  kind: string;
  label: string;
  maxClients: number;
  onesync: string;
  endpoint: string;
  convars: EnvironmentConvar[];
}

interface EnvironmentValidationFinding {
  severity: string;
  code: string;
  message: string;
}

interface EnvironmentValidationReport {
  passed: boolean;
  profileId: string;
  summary: { errors: number; warnings: number; info: number };
  findings: EnvironmentValidationFinding[];
}

interface EnvironmentDiffReport {
  fromProfileId: string;
  toProfileId: string;
  summary: {
    convarChanges: number;
    secretChanges: number;
    resourceOrderChanges: number;
    settingChanges: number;
  };
}

interface EnvironmentExportEntry {
  profileId: string;
  serverCfgExists: boolean;
  recipeExists: boolean;
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { message?: string };
    return payload.message ?? fallback;
  } catch {
    return fallback;
  }
}

function syncProfileSelection(
  profiles: EnvironmentProfile[],
  selectedEnv: string,
  diffFrom: string,
  diffTo: string,
): { selectedEnv: string; diffFrom: string; diffTo: string } {
  if (profiles.length === 0) {
    return { selectedEnv, diffFrom, diffTo };
  }

  const ids = profiles.map((profile) => profile.id);
  const pick = (value: string, fallbackIndex: number) =>
    ids.includes(value) ? value : ids[fallbackIndex] ?? ids[0]!;

  const nextSelected = pick(selectedEnv, Math.min(1, ids.length - 1));
  const nextFrom = pick(diffFrom, Math.min(1, ids.length - 1));
  let nextTo = pick(diffTo, ids.length - 1);
  if (nextTo === nextFrom && ids.length > 1) {
    nextTo = ids.find((id) => id !== nextFrom) ?? nextTo;
  }

  return { selectedEnv: nextSelected, diffFrom: nextFrom, diffTo: nextTo };
}

export default function EnvironmentPage() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceWithConfig | null>(null);
  const [profiles, setProfiles] = useState<EnvironmentProfile[]>([]);
  const [selectedEnv, setSelectedEnv] = useState("dev");
  const [diffFrom, setDiffFrom] = useState("dev");
  const [diffTo, setDiffTo] = useState("production");
  const [validation, setValidation] = useState<EnvironmentValidationReport | null>(null);
  const [diff, setDiff] = useState<EnvironmentDiffReport | null>(null);
  const [exports, setExports] = useState<EnvironmentExportEntry[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadData() {
    setStatus("loading");
    setMessage(null);

    const wsRes = await fetch("/api/v1/workspaces/active");
    if (wsRes.status === 404) {
      setActiveWorkspace(null);
      setProfiles([]);
      setStatus("missing");
      setMessage("Select or create a workspace first.");
      return;
    }

    if (!wsRes.ok) {
      setStatus("error");
      setMessage("Failed to load active workspace.");
      return;
    }

    const workspace = (await wsRes.json()) as WorkspaceWithConfig;
    setActiveWorkspace(workspace);

    const profilesRes = await fetch("/api/v1/environment/profiles");
    if (profilesRes.status === 404) {
      setProfiles([]);
      setStatus("missing");
      setMessage("No environment profiles yet. Initialize defaults to get started.");
      return;
    }

    if (!profilesRes.ok) {
      setStatus("error");
      setMessage("Failed to load environment profiles.");
      return;
    }

    const profilesPayload = (await profilesRes.json()) as { profiles: EnvironmentProfile[] };
    const nextSelection = syncProfileSelection(
      profilesPayload.profiles,
      selectedEnv,
      diffFrom,
      diffTo,
    );
    setProfiles(profilesPayload.profiles);
    setSelectedEnv(nextSelection.selectedEnv);
    setDiffFrom(nextSelection.diffFrom);
    setDiffTo(nextSelection.diffTo);

    const exportsRes = await fetch("/api/v1/environment/exports");
    if (exportsRes.ok) {
      const exportsPayload = (await exportsRes.json()) as { exports: EnvironmentExportEntry[] };
      setExports(exportsPayload.exports);
    }

    setStatus("ready");
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function runInit() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/environment/init", { method: "POST" });
      if (!res.ok) throw new Error(await readApiError(res, "Init failed"));
      await loadData();
      setMessage("Initialized local, dev, staging, and production profiles.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to initialize environment profiles.");
    } finally {
      setBusy(false);
    }
  }

  async function runGenerateCfg() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/environment/generate-cfg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ env: selectedEnv }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Generate cfg failed"));
      await loadData();
      setMessage(`Generated server.cfg for ${selectedEnv}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to generate server.cfg.");
    } finally {
      setBusy(false);
    }
  }

  async function runGenerateRecipe() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/environment/generate-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ env: selectedEnv }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Generate recipe failed"));
      await loadData();
      setMessage(`Generated txAdmin recipe for ${selectedEnv}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to generate txAdmin recipe.");
    } finally {
      setBusy(false);
    }
  }

  async function runValidate() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/environment/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ env: selectedEnv }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Validate failed"));
      const payload = (await res.json()) as { report: EnvironmentValidationReport };
      setValidation(payload.report);
      setMessage(payload.report.passed ? "Validation passed." : "Validation failed — review findings.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to validate environment profile.");
    } finally {
      setBusy(false);
    }
  }

  async function runDiff() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/environment/diff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: diffFrom, to: diffTo }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Diff failed"));
      const payload = (await res.json()) as { report: EnvironmentDiffReport };
      setDiff(payload.report);
      setMessage(`Compared ${diffFrom} → ${diffTo}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to diff environment profiles.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack page-stack-compact">
      <PageIntro
        title="Environment Builder"
        description={
          <>
            Generate repeatable <code className="inline-code">server.cfg</code> files and txAdmin recipe
            scaffolds from workspace resources and environment profiles.
            {activeWorkspace && (
              <>
                {" "}
                Workspace: <span className="text-[var(--color-accent-ink)]">{activeWorkspace.name}</span>
              </>
            )}
          </>
        }
      />

      {message && <div className="alert alert-info">{message}</div>}

      {status === "missing" && (
        <Panel className="panel-dashed">
          <p className="panel-subtext">{message}</p>
          <div className="btn-row">
            <button
              type="button"
              disabled={busy || !activeWorkspace}
              onClick={() => void runInit()}
              className="btn btn-primary btn-sm"
            >
              Initialize environment profiles
            </button>
          </div>
        </Panel>
      )}

      {status === "ready" && (
        <>
          <div className="page-grid-2">
            <Panel className="panel-compact">
              <h3 className="panel-heading">Profiles</h3>
              <ul className="list-plain panel-section">
                {profiles.map((profile) => (
                  <li key={profile.id}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="env"
                        checked={selectedEnv === profile.id}
                        onChange={() => setSelectedEnv(profile.id)}
                      />
                      <span>
                        {profile.label}{" "}
                        <span className="text-[var(--color-muted)]">
                          ({profile.kind}) · {profile.maxClients} slots · onesync {profile.onesync}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>

              <div className="btn-row">
                <button
                  type="button"
                  disabled={busy || profiles.length === 0}
                  onClick={() => void runGenerateCfg()}
                  className="btn btn-accent btn-sm"
                >
                  Generate server.cfg
                </button>
                <button
                  type="button"
                  disabled={busy || profiles.length === 0}
                  onClick={() => void runGenerateRecipe()}
                  className="btn btn-indigo btn-sm"
                >
                  Generate txAdmin recipe
                </button>
                <button
                  type="button"
                  disabled={busy || profiles.length === 0}
                  onClick={() => void runValidate()}
                  className="btn btn-secondary btn-sm"
                >
                  Validate profile
                </button>
              </div>
            </Panel>

            <Panel className="panel-compact">
              <h3 className="panel-heading">Environment diff</h3>
              <div className="form-grid form-grid-2 panel-section">
                <label className="form-field">
                  From
                  <select
                    value={diffFrom}
                    onChange={(event) => setDiffFrom(event.target.value)}
                    className="form-control"
                  >
                    {profiles.map((profile) => (
                      <option key={`from-${profile.id}`} value={profile.id}>
                        {profile.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  To
                  <select
                    value={diffTo}
                    onChange={(event) => setDiffTo(event.target.value)}
                    className="form-control"
                  >
                    {profiles.map((profile) => (
                      <option key={`to-${profile.id}`} value={profile.id}>
                        {profile.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="btn-row">
                <button
                  type="button"
                  disabled={busy || profiles.length < 2}
                  onClick={() => void runDiff()}
                  className="btn btn-secondary btn-sm"
                >
                  Compare environments
                </button>
              </div>

              {diff && (
                <div className="panel-section rounded-xl border border-[var(--color-line)] bg-[var(--color-input-bg)] p-3 text-sm">
                  <p>
                    {diff.fromProfileId} → {diff.toProfileId}
                  </p>
                  <ul className="list-plain mt-2 text-xs text-[var(--color-muted)]">
                    <li>Convar changes: {diff.summary.convarChanges}</li>
                    <li>Secret changes: {diff.summary.secretChanges}</li>
                    <li>Setting changes: {diff.summary.settingChanges}</li>
                    <li>Resource order changes: {diff.summary.resourceOrderChanges}</li>
                  </ul>
                </div>
              )}
            </Panel>
          </div>

          {(validation || exports.length > 0) && (
            <div className="page-grid-2">
              {validation && (
                <Panel className="panel-compact">
                  <h3 className="panel-heading">
                    Validation: {validation.profileId}{" "}
                    <span className={validation.passed ? "text-emerald-400" : "text-rose-400"}>
                      {validation.passed ? "passed" : "failed"}
                    </span>
                  </h3>
                  <ul className="list-plain panel-section text-sm">
                    {validation.findings.length === 0 && (
                      <li className="text-[var(--color-muted)]">No findings.</li>
                    )}
                    {validation.findings.map((finding) => (
                      <li key={`${finding.code}-${finding.message}`}>
                        <span
                          className={`finding-badge ${
                            finding.severity === "error"
                              ? "finding-badge-error"
                              : finding.severity === "warning"
                                ? "finding-badge-warning"
                                : "finding-badge-info"
                          }`}
                        >
                          {finding.severity}
                        </span>
                        {finding.message}
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}

              {exports.length > 0 && (
                <Panel className="panel-compact">
                  <h3 className="panel-heading">Generated exports</h3>
                  <p className="panel-subtext">
                    Outputs under <code className="inline-code">.fdt/exports/txadmin/</code>
                  </p>
                  <ul className="list-plain panel-section text-sm">
                    {exports.map((entry) => (
                      <li key={entry.profileId}>
                        {entry.profileId}: server.cfg {entry.serverCfgExists ? "✓" : "—"}, recipe{" "}
                        {entry.recipeExists ? "✓" : "—"}
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
            </div>
          )}
        </>
      )}

      {status === "error" && <div className="alert alert-error">{message}</div>}
    </div>
  );
}
