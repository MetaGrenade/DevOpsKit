import { useEffect, useState } from "react";
import type { WorkspaceWithConfig } from "../types/api";

interface ReleaseValidationSummary {
  errors: number;
  warnings: number;
  passed: number;
}

interface ReleaseStatusHistoryEntry {
  status: string;
  changedAt: string;
  changedBy?: string;
  note?: string;
}

interface Release {
  id: string;
  version: string;
  createdAt: string;
  createdBy?: string;
  targetEnvironment: string;
  status: string;
  statusHistory: ReleaseStatusHistoryEntry[];
  changedResources: string[];
  changedContent: string[];
  changedZones: string[];
  changedAssets: string[];
  validationSummary: ReleaseValidationSummary;
  changelogMarkdown: string;
  bundlePath?: string;
}

interface QaReleaseSummary {
  releaseId: string;
  totalRuns: number;
  completed: number;
  failed: number;
  inProgress: number;
  latestStatus: string;
}

interface QaRunSummary {
  id: string;
  scenarioId: string;
  scenarioLabel?: string;
  status: string;
  startedAt: string;
  releaseVersion?: string;
}

interface PerformanceReleaseSummary {
  releaseId: string;
  totalSnapshots: number;
  latestSnapshotId: string | null;
  latestCapturedAt: string | null;
  regressions: number;
  status: "none" | "ok" | "regressions";
}

interface PerformanceSnapshotSummary {
  id: string;
  label?: string;
  capturedAt: string;
  resources: Array<{ resource: string }>;
}

interface ReleaseChecklistItem {
  id: string;
  label: string;
  status: "passed" | "failed" | "warning" | "skipped";
  blocking: boolean;
  message?: string;
}

interface ReleaseChecklistReport {
  releaseVersion: string;
  releaseStatus: string;
  passed: boolean;
  summary: {
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
  };
  items: ReleaseChecklistItem[];
}

interface ReleaseDiffSection {
  added: string[];
  removed: string[];
  unchanged: string[];
}

interface ReleaseDiffReport {
  fromVersion: string;
  toVersion: string;
  sections: {
    resources: ReleaseDiffSection;
    content: ReleaseDiffSection;
    zones: ReleaseDiffSection;
    assets: ReleaseDiffSection;
    databaseMigrations: ReleaseDiffSection;
  };
}

const STATUS_OPTIONS = [
  "validated",
  "qa-ready",
  "qa-approved",
  "deployed",
  "rolled-back",
] as const;

export default function ReleasesPage() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceWithConfig | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);
  const [createVersion, setCreateVersion] = useState("0.1.0");
  const [createEnvironment, setCreateEnvironment] = useState("dev");
  const [statusNote, setStatusNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [qaSummary, setQaSummary] = useState<QaReleaseSummary | null>(null);
  const [qaRuns, setQaRuns] = useState<QaRunSummary[]>([]);
  const [perfSummary, setPerfSummary] = useState<PerformanceReleaseSummary | null>(null);
  const [perfSnapshots, setPerfSnapshots] = useState<PerformanceSnapshotSummary[]>([]);
  const [checklist, setChecklist] = useState<ReleaseChecklistReport | null>(null);
  const [diffFromVersion, setDiffFromVersion] = useState("");
  const [diffReport, setDiffReport] = useState<ReleaseDiffReport | null>(null);
  const [exportingBundle, setExportingBundle] = useState(false);

  async function loadData() {
    setLoading(true);
    setMessage(null);

    try {
      const wsRes = await fetch("/api/v1/workspaces/active");
      if (wsRes.status === 404) {
        setActiveWorkspace(null);
        setReleases([]);
        setSelectedRelease(null);
        return;
      }
      if (!wsRes.ok) throw new Error("Failed to load active workspace");
      setActiveWorkspace((await wsRes.json()) as WorkspaceWithConfig);

      const releasesRes = await fetch("/api/v1/releases");
      if (releasesRes.ok) {
        const data = (await releasesRes.json()) as { releases: Release[] };
        setReleases(data.releases);
        if (data.releases[0]) {
          setSelectedRelease(data.releases[0]);
        }
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

  useEffect(() => {
    if (!selectedRelease) {
      setQaSummary(null);
      setQaRuns([]);
      setPerfSummary(null);
      setPerfSnapshots([]);
      setChecklist(null);
      setDiffReport(null);
      return;
    }

    setDiffFromVersion((current) => {
      if (current) return current;
      const other = releases.find((release) => release.id !== selectedRelease.id);
      return other?.version ?? "";
    });

    void (async () => {
      const response = await fetch(`/api/v1/releases/${encodeURIComponent(selectedRelease.id)}/qa`);
      if (!response.ok) {
        setQaSummary(null);
        setQaRuns([]);
      } else {
        const data = (await response.json()) as {
          summary: QaReleaseSummary;
          runs: QaRunSummary[];
        };
        setQaSummary(data.summary);
        setQaRuns(data.runs);
      }

      const perfResponse = await fetch(
        `/api/v1/releases/${encodeURIComponent(selectedRelease.id)}/performance`,
      );
      if (!perfResponse.ok) {
        setPerfSummary(null);
        setPerfSnapshots([]);
        return;
      }

      const perfData = (await perfResponse.json()) as {
        summary: PerformanceReleaseSummary;
        snapshots: PerformanceSnapshotSummary[];
      };
      setPerfSummary(perfData.summary);
      setPerfSnapshots(perfData.snapshots);

      const checklistResponse = await fetch(
        `/api/v1/releases/${encodeURIComponent(selectedRelease.id)}/checklist`,
      );
      if (checklistResponse.ok) {
        const checklistData = (await checklistResponse.json()) as { report: ReleaseChecklistReport };
        setChecklist(checklistData.report);
      } else {
        setChecklist(null);
      }
    })();
  }, [selectedRelease?.id, releases]);

  async function handleCreateRelease(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    const response = await fetch("/api/v1/releases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: createVersion.trim(),
        targetEnvironment: createEnvironment,
      }),
    });

    const payload = (await response.json()) as { message?: string; release?: Release };
    if (!response.ok) {
      setMessage(payload.message ?? "Failed to create release");
      return;
    }

    setMessage(`Created release ${payload.release?.version ?? createVersion}`);
    await loadData();
  }

  async function handleMarkStatus(status: string) {
    if (!selectedRelease) return;
    setMessage(null);

    const response = await fetch(
      `/api/v1/releases/${encodeURIComponent(selectedRelease.id)}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: statusNote.trim() || undefined }),
      },
    );

    const payload = (await response.json()) as { message?: string; release?: Release };
    if (!response.ok) {
      setMessage(payload.message ?? "Failed to update status");
      return;
    }

    setStatusNote("");
    setMessage(`Release marked as ${status}`);
    await loadData();
    if (payload.release) {
      setSelectedRelease(payload.release);
    }
  }

  async function handleLoadDiff() {
    if (!selectedRelease || !diffFromVersion.trim()) return;
    setMessage(null);

    const response = await fetch(
      `/api/v1/releases/diff?from=${encodeURIComponent(diffFromVersion.trim())}&to=${encodeURIComponent(selectedRelease.version)}`,
    );
    const payload = (await response.json()) as { message?: string; report?: ReleaseDiffReport };
    if (!response.ok) {
      setMessage(payload.message ?? "Failed to load release diff");
      setDiffReport(null);
      return;
    }

    setDiffReport(payload.report ?? null);
  }

  async function handleExportBundle() {
    if (!selectedRelease) return;
    setExportingBundle(true);
    setMessage(null);

    const response = await fetch(
      `/api/v1/releases/${encodeURIComponent(selectedRelease.id)}/bundle`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );

    const payload = (await response.json()) as { message?: string; outputDir?: string };
    setExportingBundle(false);

    if (!response.ok) {
      setMessage(payload.message ?? "Failed to export bundle");
      return;
    }

    setMessage(`Bundle exported to ${payload.outputDir ?? ".fdt/exports/releases/" + selectedRelease.version}`);
  }

  if (loading) {
    return <p className="text-sm text-slate-400">Loading releases…</p>;
  }

  if (!activeWorkspace) {
    return (
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <h2 className="text-xl font-semibold">Releases</h2>
        <p className="mt-2 text-sm text-slate-400">Select an active workspace to manage releases.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <h2 className="text-xl font-semibold">Release Manager</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          Create release candidates from validation reports stored in{" "}
          <code className="rounded bg-white/5 px-1.5 py-0.5">.fdt/reports/</code>. Bundles are
          written to{" "}
          <code className="rounded bg-white/5 px-1.5 py-0.5">.fdt/releases/&lt;version&gt;/</code>{" "}
          with changelog and rollback manifest.
        </p>

        <div className="mt-4 rounded-xl border border-dashed border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-slate-300">
          <p className="font-medium text-cyan-200">Before creating a release</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-400">
            <li>
              Run <code className="text-slate-200">fdt validate resources</code>
            </li>
            <li>
              Optionally run <code className="text-slate-200">fdt content validate</code> and{" "}
              <code className="text-slate-200">fdt audit stream</code>
            </li>
            <li>
              Create via CLI:{" "}
              <code className="text-slate-200">fdt release create --version 0.1.0</code>
            </li>
            <li>
              Diff:{" "}
              <code className="text-slate-200">fdt release diff --from 0.3.9 --to 0.4.0</code>
            </li>
            <li>
              Checklist:{" "}
              <code className="text-slate-200">fdt release checklist --version 0.4.0</code>
            </li>
            <li>
              Export bundle:{" "}
              <code className="text-slate-200">fdt release bundle --version 0.4.0 --out ./releases/0.4.0</code>
            </li>
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
          <h3 className="font-semibold">Create Release</h3>
          <form className="mt-4 space-y-3 text-sm" onSubmit={handleCreateRelease}>
            <label className="block">
              <span className="text-slate-400">Version</span>
              <input
                required
                value={createVersion}
                onChange={(e) => setCreateVersion(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-slate-400">Environment</span>
              <select
                value={createEnvironment}
                onChange={(e) => setCreateEnvironment(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
              >
                {["local", "dev", "staging", "production"].map((env) => (
                  <option key={env} value={env}>
                    {env}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-lg bg-cyan-500/20 px-4 py-2 font-medium text-cyan-200 hover:bg-cyan-500/30"
            >
              Create release
            </button>
          </form>

          <h3 className="mt-8 font-semibold">Releases ({releases.length})</h3>
          <div className="mt-3 space-y-2">
            {releases.length === 0 ? (
              <p className="text-sm text-slate-400">No releases yet.</p>
            ) : (
              releases.map((release) => (
                <button
                  key={release.id}
                  type="button"
                  onClick={() => setSelectedRelease(release)}
                  className={`block w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    selectedRelease?.id === release.id
                      ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-100"
                      : "border-white/10 bg-[#0b1020] text-slate-300 hover:border-white/20"
                  }`}
                >
                  <div className="font-medium">{release.version}</div>
                  <div className="text-xs text-slate-500">{release.status}</div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
          {selectedRelease ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">Release {selectedRelease.version}</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    {selectedRelease.targetEnvironment} · {selectedRelease.status}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <div>{new Date(selectedRelease.createdAt).toLocaleString()}</div>
                  {selectedRelease.bundlePath && <div>{selectedRelease.bundlePath}</div>}
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-white/10 bg-[#0b1020] p-3 text-sm">
                  <div className="text-slate-500">Validation errors</div>
                  <div className="text-xl font-semibold text-rose-300">
                    {selectedRelease.validationSummary.errors}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#0b1020] p-3 text-sm">
                  <div className="text-slate-500">Warnings</div>
                  <div className="text-xl font-semibold text-amber-300">
                    {selectedRelease.validationSummary.warnings}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#0b1020] p-3 text-sm">
                  <div className="text-slate-500">Resources changed</div>
                  <div className="text-xl font-semibold text-cyan-200">
                    {selectedRelease.changedResources.length}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="font-medium">QA status</h4>
                {qaSummary && qaSummary.totalRuns > 0 ? (
                  <>
                    <div className="mt-3 grid gap-4 sm:grid-cols-4">
                      <div className="rounded-lg border border-white/10 bg-[#0b1020] p-3 text-sm">
                        <div className="text-slate-500">Total runs</div>
                        <div className="text-xl font-semibold text-cyan-200">{qaSummary.totalRuns}</div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-[#0b1020] p-3 text-sm">
                        <div className="text-slate-500">Completed</div>
                        <div className="text-xl font-semibold text-emerald-300">{qaSummary.completed}</div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-[#0b1020] p-3 text-sm">
                        <div className="text-slate-500">Failed</div>
                        <div className="text-xl font-semibold text-rose-300">{qaSummary.failed}</div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-[#0b1020] p-3 text-sm">
                        <div className="text-slate-500">Latest</div>
                        <div className="text-xl font-semibold text-amber-200">{qaSummary.latestStatus}</div>
                      </div>
                    </div>
                    <ul className="mt-3 space-y-2 text-sm text-slate-400">
                      {qaRuns.map((run) => (
                        <li key={run.id} className="rounded-lg bg-[#0b1020] px-3 py-2">
                          <span className="text-cyan-200">{run.scenarioLabel ?? run.scenarioId}</span> ·{" "}
                          {run.status} · {new Date(run.startedAt).toLocaleString()}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-slate-400">
                    No QA runs attached. Import runs from the QA page or in-game export.
                  </p>
                )}
              </div>

              <div className="mt-6">
                <h4 className="font-medium">Performance status</h4>
                {perfSummary && perfSummary.totalSnapshots > 0 ? (
                  <>
                    <div className="mt-3 grid gap-4 sm:grid-cols-4">
                      <div className="rounded-lg border border-white/10 bg-[#0b1020] p-3 text-sm">
                        <div className="text-slate-500">Snapshots</div>
                        <div className="text-xl font-semibold text-cyan-200">{perfSummary.totalSnapshots}</div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-[#0b1020] p-3 text-sm">
                        <div className="text-slate-500">Status</div>
                        <div
                          className={`text-xl font-semibold ${
                            perfSummary.status === "regressions"
                              ? "text-rose-300"
                              : perfSummary.status === "ok"
                                ? "text-emerald-300"
                                : "text-slate-300"
                          }`}
                        >
                          {perfSummary.status}
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-[#0b1020] p-3 text-sm">
                        <div className="text-slate-500">Regressions</div>
                        <div className="text-xl font-semibold text-rose-300">{perfSummary.regressions}</div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-[#0b1020] p-3 text-sm">
                        <div className="text-slate-500">Latest capture</div>
                        <div className="text-sm font-medium text-amber-200">
                          {perfSummary.latestCapturedAt
                            ? new Date(perfSummary.latestCapturedAt).toLocaleString()
                            : "—"}
                        </div>
                      </div>
                    </div>
                    <ul className="mt-3 space-y-2 text-sm text-slate-400">
                      {perfSnapshots.map((snapshot) => (
                        <li key={snapshot.id} className="rounded-lg bg-[#0b1020] px-3 py-2">
                          <span className="text-cyan-200">{snapshot.label ?? snapshot.id}</span> ·{" "}
                          {snapshot.resources.length} resources ·{" "}
                          {new Date(snapshot.capturedAt).toLocaleString()}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-slate-400">
                    No performance snapshots attached. Import via the Performance page or{" "}
                    <code className="text-slate-200">fdt perf import</code>.
                  </p>
                )}
              </div>

              <div className="mt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="font-medium">Deploy checklist</h4>
                  <button
                    type="button"
                    onClick={() => void handleExportBundle()}
                    disabled={exportingBundle}
                    className="rounded-lg bg-cyan-500/15 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-50"
                  >
                    {exportingBundle ? "Exporting…" : "Export bundle"}
                  </button>
                </div>
                {checklist ? (
                  <>
                    <p
                      className={`mt-2 text-sm ${
                        checklist.passed ? "text-emerald-300" : "text-rose-300"
                      }`}
                    >
                      Checklist {checklist.passed ? "passed" : "failed"} · {checklist.summary.passed}{" "}
                      passed · {checklist.summary.failed} failed · {checklist.summary.warnings} warnings
                    </p>
                    <ul className="mt-3 space-y-2 text-sm text-slate-400">
                      {checklist.items.map((item) => (
                        <li key={item.id} className="rounded-lg bg-[#0b1020] px-3 py-2">
                          <span
                            className={
                              item.status === "passed"
                                ? "text-emerald-300"
                                : item.status === "failed"
                                  ? "text-rose-300"
                                  : item.status === "warning"
                                    ? "text-amber-300"
                                    : "text-slate-400"
                            }
                          >
                            {item.status}
                          </span>{" "}
                          · {item.label}
                          {item.blocking ? " (blocking)" : ""}
                          {item.message ? ` — ${item.message}` : ""}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-slate-400">Loading checklist…</p>
                )}
              </div>

              <div className="mt-6">
                <h4 className="font-medium">Release diff</h4>
                <div className="mt-2 flex flex-wrap items-end gap-2 text-sm">
                  <label className="block">
                    <span className="text-slate-400">From version</span>
                    <select
                      value={diffFromVersion}
                      onChange={(e) => setDiffFromVersion(e.target.value)}
                      className="mt-1 block rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
                    >
                      <option value="">Select…</option>
                      {releases
                        .filter((release) => release.id !== selectedRelease.id)
                        .map((release) => (
                          <option key={release.id} value={release.version}>
                            {release.version}
                          </option>
                        ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleLoadDiff()}
                    disabled={!diffFromVersion}
                    className="rounded-lg bg-cyan-500/15 px-3 py-2 text-xs font-medium text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-50"
                  >
                    Compare → {selectedRelease.version}
                  </button>
                </div>
                {diffReport && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                    {(
                      [
                        ["Resources", diffReport.sections.resources],
                        ["Content", diffReport.sections.content],
                        ["Zones", diffReport.sections.zones],
                        ["Assets", diffReport.sections.assets],
                        ["Migrations", diffReport.sections.databaseMigrations],
                      ] as const
                    ).map(([title, section]) => (
                      <div key={title} className="rounded-lg border border-white/10 bg-[#0b1020] p-3">
                        <div className="font-medium text-cyan-200">{title}</div>
                        <div className="mt-1 text-slate-400">
                          +{section.added.length} / -{section.removed.length} / =
                          {section.unchanged.length}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6">
                <h4 className="font-medium">Update status</h4>
                <textarea
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  rows={2}
                  placeholder="Optional note for approval history"
                  className="mt-2 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2 text-sm"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => void handleMarkStatus(status)}
                      className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/25"
                    >
                      Mark {status}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <h4 className="font-medium">Approval history</h4>
                <ul className="mt-2 space-y-2 text-sm text-slate-400">
                  {selectedRelease.statusHistory.map((entry, index) => (
                    <li key={`${entry.changedAt}-${index}`} className="rounded-lg bg-[#0b1020] px-3 py-2">
                      <span className="text-cyan-200">{entry.status}</span> ·{" "}
                      {new Date(entry.changedAt).toLocaleString()}
                      {entry.note ? ` — ${entry.note}` : ""}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6">
                <h4 className="font-medium">Changelog</h4>
                <pre className="mt-2 overflow-x-auto rounded-lg border border-white/10 bg-[#0b1020] p-4 text-xs text-slate-300">
                  {selectedRelease.changelogMarkdown}
                </pre>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400">Select a release to view details.</p>
          )}
        </section>
      </div>
    </div>
  );
}
