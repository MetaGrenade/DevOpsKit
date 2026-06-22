import { useEffect, useState } from "react";
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
    <section className="space-y-6">
      <header className="rounded-2xl border border-white/10 bg-[#111831] p-6">
        <h2 className="text-xl font-semibold">Environment Builder</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          Generate repeatable <code className="rounded bg-white/5 px-1.5 py-0.5">server.cfg</code> files and
          txAdmin recipe scaffolds from workspace resources and environment profiles.
        </p>
        {activeWorkspace && (
          <p className="mt-2 text-xs text-slate-400">
            Workspace: <span className="text-cyan-200">{activeWorkspace.name}</span>
          </p>
        )}
      </header>

      {message && (
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
          {message}
        </div>
      )}

      {status === "missing" && (
        <div className="rounded-2xl border border-dashed border-white/10 bg-[#111831] p-6">
          <p className="text-sm text-slate-300">{message}</p>
          <button
            type="button"
            disabled={busy || !activeWorkspace}
            onClick={() => void runInit()}
            className="mt-4 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Initialize environment profiles
          </button>
        </div>
      )}

      {status === "ready" && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-2xl border border-white/10 bg-[#111831] p-6">
              <h3 className="font-medium">Profiles</h3>
              <div className="mt-4 space-y-2">
                {profiles.map((profile) => (
                  <label key={profile.id} className="flex items-center gap-3 text-sm">
                    <input
                      type="radio"
                      name="env"
                      checked={selectedEnv === profile.id}
                      onChange={() => setSelectedEnv(profile.id)}
                    />
                    <span>
                      {profile.label}{" "}
                      <span className="text-slate-400">
                        ({profile.kind}) · {profile.maxClients} slots · onesync {profile.onesync}
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || profiles.length === 0}
                  onClick={() => void runGenerateCfg()}
                  className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                  Generate server.cfg
                </button>
                <button
                  type="button"
                  disabled={busy || profiles.length === 0}
                  onClick={() => void runGenerateRecipe()}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                  Generate txAdmin recipe
                </button>
                <button
                  type="button"
                  disabled={busy || profiles.length === 0}
                  onClick={() => void runValidate()}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-200 disabled:opacity-50"
                >
                  Validate profile
                </button>
              </div>
            </article>

            <article className="rounded-2xl border border-white/10 bg-[#111831] p-6">
              <h3 className="font-medium">Environment diff</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  From
                  <select
                    value={diffFrom}
                    onChange={(event) => setDiffFrom(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
                  >
                    {profiles.map((profile) => (
                      <option key={`from-${profile.id}`} value={profile.id}>
                        {profile.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  To
                  <select
                    value={diffTo}
                    onChange={(event) => setDiffTo(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
                  >
                    {profiles.map((profile) => (
                      <option key={`to-${profile.id}`} value={profile.id}>
                        {profile.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                type="button"
                disabled={busy || profiles.length < 2}
                onClick={() => void runDiff()}
                className="mt-4 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-200 disabled:opacity-50"
              >
                Compare environments
              </button>

              {diff && (
                <div className="mt-4 rounded-xl border border-white/10 bg-[#0b1020] p-4 text-sm text-slate-300">
                  <p>
                    {diff.fromProfileId} → {diff.toProfileId}
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-slate-400">
                    <li>Convar changes: {diff.summary.convarChanges}</li>
                    <li>Secret changes: {diff.summary.secretChanges}</li>
                    <li>Setting changes: {diff.summary.settingChanges}</li>
                    <li>Resource order changes: {diff.summary.resourceOrderChanges}</li>
                  </ul>
                </div>
              )}
            </article>
          </div>

          {validation && (
            <article className="rounded-2xl border border-white/10 bg-[#111831] p-6">
              <h3 className="font-medium">
                Validation: {validation.profileId}{" "}
                <span className={validation.passed ? "text-emerald-300" : "text-rose-300"}>
                  {validation.passed ? "passed" : "failed"}
                </span>
              </h3>
              <ul className="mt-4 space-y-2 text-sm">
                {validation.findings.length === 0 && (
                  <li className="text-slate-400">No findings.</li>
                )}
                {validation.findings.map((finding) => (
                  <li key={`${finding.code}-${finding.message}`} className="text-slate-300">
                    <span
                      className={`mr-2 rounded px-2 py-0.5 text-xs uppercase ${
                        finding.severity === "error"
                          ? "bg-rose-500/15 text-rose-200"
                          : finding.severity === "warning"
                            ? "bg-amber-500/15 text-amber-200"
                            : "bg-slate-500/10 text-slate-300"
                      }`}
                    >
                      {finding.severity}
                    </span>
                    {finding.message}
                  </li>
                ))}
              </ul>
            </article>
          )}

          {exports.length > 0 && (
            <article className="rounded-2xl border border-white/10 bg-[#111831] p-6">
              <h3 className="font-medium">Generated exports</h3>
              <p className="mt-2 text-xs text-slate-400">
                Outputs under <code className="rounded bg-white/5 px-1">.fdt/exports/txadmin/</code>
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-300">
                {exports.map((entry) => (
                  <li key={entry.profileId}>
                    {entry.profileId}: server.cfg {entry.serverCfgExists ? "✓" : "—"}, recipe{" "}
                    {entry.recipeExists ? "✓" : "—"}
                  </li>
                ))}
              </ul>
            </article>
          )}
        </>
      )}

      {status === "error" && (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-100">
          {message}
        </div>
      )}
    </section>
  );
}
