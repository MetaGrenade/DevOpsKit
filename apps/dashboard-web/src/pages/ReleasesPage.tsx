import { useEffect, useState } from "react";
import {
  EmptyState,
  NotePanel,
  PageIntro,
  PageStack,
  Panel,
  StatGrid,
  StatTile,
} from "../components/ui/page";
import { SkeletonText } from "../components/ui/primitives";
import { useToast } from "../components/ui/Toast";
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

function checklistStatusClass(status: ReleaseChecklistItem["status"]): string {
  switch (status) {
    case "passed":
      return "path-ok";
    case "failed":
      return "path-bad";
    case "warning":
      return "stat-tile-value-warning";
    default:
      return "text-[var(--color-muted)]";
  }
}

function perfStatusTone(status: PerformanceReleaseSummary["status"]): "success" | "danger" | "muted" {
  if (status === "regressions") return "danger";
  if (status === "ok") return "success";
  return "muted";
}

export default function ReleasesPage() {
  const { notify } = useToast();
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceWithConfig | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);
  const [createVersion, setCreateVersion] = useState("0.1.0");
  const [createEnvironment, setCreateEnvironment] = useState("dev");
  const [statusNote, setStatusNote] = useState("");
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
      notify({
        title: "Failed to load releases",
        message: error instanceof Error ? error.message : String(error),
        tone: "error",
      });
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
      notify({ title: "Failed to create release", message: payload.message ?? undefined, tone: "error" });
      return;
    }

    notify({
      title: `Created release ${payload.release?.version ?? createVersion}`,
      tone: "success",
    });
    await loadData();
  }

  async function handleMarkStatus(status: string) {
    if (!selectedRelease) return;

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
      notify({ title: "Failed to update status", message: payload.message ?? undefined, tone: "error" });
      return;
    }

    setStatusNote("");
    notify({ title: `Release marked as ${status}`, tone: "success" });
    await loadData();
    if (payload.release) {
      setSelectedRelease(payload.release);
    }
  }

  async function handleLoadDiff() {
    if (!selectedRelease || !diffFromVersion.trim()) return;

    const response = await fetch(
      `/api/v1/releases/diff?from=${encodeURIComponent(diffFromVersion.trim())}&to=${encodeURIComponent(selectedRelease.version)}`,
    );
    const payload = (await response.json()) as { message?: string; report?: ReleaseDiffReport };
    if (!response.ok) {
      notify({ title: "Failed to load release diff", message: payload.message ?? undefined, tone: "error" });
      setDiffReport(null);
      return;
    }

    setDiffReport(payload.report ?? null);
  }

  async function handleExportBundle() {
    if (!selectedRelease) return;
    setExportingBundle(true);

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
      notify({ title: "Failed to export bundle", message: payload.message ?? undefined, tone: "error" });
      return;
    }

    notify({
      title: "Bundle exported",
      message: payload.outputDir ?? ".fdt/exports/releases/" + selectedRelease.version,
      tone: "success",
    });
  }

  if (loading) {
    return (
      <PageStack>
        <Panel className="panel-compact">
          <SkeletonText lines={6} />
        </Panel>
      </PageStack>
    );
  }

  if (!activeWorkspace) {
    return (
      <PageStack>
        <EmptyState title="Releases" description="Select an active workspace to manage releases." variant="workspace" />
      </PageStack>
    );
  }

  return (
    <PageStack>
      <PageIntro
        title="Release Manager"
        description={
          <>
            Create release candidates from validation reports in{" "}
            <code className="inline-code">.fdt/reports/</code>. Bundles are written to{" "}
            <code className="inline-code">.fdt/releases/&lt;version&gt;/</code> with changelog and rollback
            manifest.
          </>
        }
      />

      <NotePanel title="Before creating a release">
        <ol>
          <li>
            Run <code>fdt validate resources</code>
          </li>
          <li>
            Optionally run <code>fdt content validate</code> and <code>fdt audit stream</code>
          </li>
          <li>
            Create via CLI: <code>fdt release create --version 0.1.0</code>
          </li>
          <li>
            Diff: <code>fdt release diff --from 0.3.9 --to 0.4.0</code>
          </li>
          <li>
            Checklist: <code>fdt release checklist --version 0.4.0</code>
          </li>
          <li>
            Export bundle: <code>fdt release bundle --version 0.4.0 --out ./releases/0.4.0</code>
          </li>
        </ol>
      </NotePanel>

      <div className="page-grid-2">
        <Panel className="panel-compact">
          <h3 className="panel-heading">Create Release</h3>
          <form className="form-stack panel-section" onSubmit={handleCreateRelease}>
            <label className="form-field">
              <span className="form-label">Version</span>
              <input
                required
                value={createVersion}
                onChange={(e) => setCreateVersion(e.target.value)}
                className="form-control"
              />
            </label>
            <label className="form-field">
              <span className="form-label">Environment</span>
              <select
                value={createEnvironment}
                onChange={(e) => setCreateEnvironment(e.target.value)}
                className="form-control"
              >
                {["local", "dev", "staging", "production"].map((env) => (
                  <option key={env} value={env}>
                    {env}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn btn-accent btn-sm">
              Create release
            </button>
          </form>

          <h3 className="panel-heading panel-section">Releases ({releases.length})</h3>
          <div className="panel-section space-y-2">
            {releases.length === 0 ? (
              <p className="panel-subtext">No releases yet.</p>
            ) : (
              releases.map((release) => (
                <button
                  key={release.id}
                  type="button"
                  onClick={() => setSelectedRelease(release)}
                  className={`browse-item w-full ${
                    selectedRelease?.id === release.id ? "workspace-card-active" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1 text-left">
                    <div className="font-medium">{release.version}</div>
                    <div className="text-xs text-[var(--color-muted)]">{release.status}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </Panel>

        <Panel className="panel-compact">
          {selectedRelease ? (
            <>
              <div className="workspace-card-head">
                <div>
                  <h3 className="panel-heading">Release {selectedRelease.version}</h3>
                  <p className="panel-subtext">
                    {selectedRelease.targetEnvironment} · {selectedRelease.status}
                  </p>
                </div>
                <div className="text-right text-xs text-[var(--color-muted)]">
                  <div>{new Date(selectedRelease.createdAt).toLocaleString()}</div>
                  {selectedRelease.bundlePath && <div>{selectedRelease.bundlePath}</div>}
                </div>
              </div>

              <div className="panel-section">
                <StatGrid columns={3}>
                <StatTile
                  label="Validation errors"
                  value={selectedRelease.validationSummary.errors}
                  tone="danger"
                />
                <StatTile
                  label="Warnings"
                  value={selectedRelease.validationSummary.warnings}
                  tone="warning"
                />
                <StatTile
                  label="Resources changed"
                  value={selectedRelease.changedResources.length}
                  tone="muted"
                />
              </StatGrid>
              </div>

              <div className="panel-section">
                <h4 className="panel-heading">QA status</h4>
                {qaSummary && qaSummary.totalRuns > 0 ? (
                  <>
                    <StatGrid columns={4}>
                      <StatTile label="Total runs" value={qaSummary.totalRuns} />
                      <StatTile label="Completed" value={qaSummary.completed} tone="success" />
                      <StatTile label="Failed" value={qaSummary.failed} tone="danger" />
                      <StatTile label="Latest" value={qaSummary.latestStatus} tone="warning" />
                    </StatGrid>
                    <ul className="list-plain panel-section text-sm text-[var(--color-muted)]">
                      {qaRuns.map((run) => (
                        <li key={run.id} className="finding-card">
                          <span className="text-[var(--color-accent-ink)]">
                            {run.scenarioLabel ?? run.scenarioId}
                          </span>{" "}
                          · {run.status} · {new Date(run.startedAt).toLocaleString()}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="panel-subtext">
                    No QA runs attached. Import runs from the QA page or in-game export.
                  </p>
                )}
              </div>

              <div className="panel-section">
                <h4 className="panel-heading">Performance status</h4>
                {perfSummary && perfSummary.totalSnapshots > 0 ? (
                  <>
                    <StatGrid columns={4}>
                      <StatTile label="Snapshots" value={perfSummary.totalSnapshots} />
                      <StatTile
                        label="Status"
                        value={perfSummary.status}
                        tone={perfStatusTone(perfSummary.status)}
                      />
                      <StatTile label="Regressions" value={perfSummary.regressions} tone="danger" />
                      <StatTile
                        label="Latest capture"
                        value={
                          perfSummary.latestCapturedAt
                            ? new Date(perfSummary.latestCapturedAt).toLocaleString()
                            : "—"
                        }
                        tone="muted"
                      />
                    </StatGrid>
                    <ul className="list-plain panel-section text-sm text-[var(--color-muted)]">
                      {perfSnapshots.map((snapshot) => (
                        <li key={snapshot.id} className="finding-card">
                          <span className="text-[var(--color-accent-ink)]">
                            {snapshot.label ?? snapshot.id}
                          </span>{" "}
                          · {snapshot.resources.length} resources ·{" "}
                          {new Date(snapshot.capturedAt).toLocaleString()}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="panel-subtext">
                    No performance snapshots attached. Import via the Performance page or{" "}
                    <code className="inline-code">fdt perf import</code>.
                  </p>
                )}
              </div>

              <div className="panel-section">
                <div className="workspace-card-head">
                  <h4 className="panel-heading">Deploy checklist</h4>
                  <button
                    type="button"
                    onClick={() => void handleExportBundle()}
                    disabled={exportingBundle}
                    className="btn btn-accent btn-sm"
                  >
                    {exportingBundle ? "Exporting…" : "Export bundle"}
                  </button>
                </div>
                {checklist ? (
                  <>
                    <p
                      className={`panel-subtext ${checklist.passed ? "path-ok" : "path-bad"}`}
                    >
                      Checklist {checklist.passed ? "passed" : "failed"} · {checklist.summary.passed}{" "}
                      passed · {checklist.summary.failed} failed · {checklist.summary.warnings} warnings
                    </p>
                    <ul className="list-plain panel-section text-sm">
                      {checklist.items.map((item) => (
                        <li key={item.id} className="finding-card">
                          <span className={checklistStatusClass(item.status)}>{item.status}</span> ·{" "}
                          {item.label}
                          {item.blocking ? " (blocking)" : ""}
                          {item.message ? ` — ${item.message}` : ""}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="panel-subtext">Loading checklist…</p>
                )}
              </div>

              <div className="panel-section">
                <h4 className="panel-heading">Release diff</h4>
                <div className="form-grid form-grid-2">
                  <label className="form-field">
                    <span className="form-label">From version</span>
                    <select
                      value={diffFromVersion}
                      onChange={(e) => setDiffFromVersion(e.target.value)}
                      className="form-control"
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
                  <div className="btn-row self-end">
                    <button
                      type="button"
                      onClick={() => void handleLoadDiff()}
                      disabled={!diffFromVersion}
                      className="btn btn-secondary btn-sm"
                    >
                      Compare → {selectedRelease.version}
                    </button>
                  </div>
                </div>
                {diffReport && (
                  <div className="page-grid-2 panel-section">
                    {(
                      [
                        ["Resources", diffReport.sections.resources],
                        ["Content", diffReport.sections.content],
                        ["Zones", diffReport.sections.zones],
                        ["Assets", diffReport.sections.assets],
                        ["Migrations", diffReport.sections.databaseMigrations],
                      ] as const
                    ).map(([title, section]) => (
                      <article key={title} className="stat-tile">
                        <p className="stat-tile-label">{title}</p>
                        <p className="stat-tile-value text-base">
                          +{section.added.length} / -{section.removed.length} / ={section.unchanged.length}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <div className="panel-section">
                <h4 className="panel-heading">Update status</h4>
                <textarea
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  rows={2}
                  placeholder="Optional note for approval history"
                  className="form-control panel-section"
                />
                <div className="btn-row">
                  {STATUS_OPTIONS.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => void handleMarkStatus(status)}
                      className="btn btn-secondary btn-sm"
                    >
                      Mark {status}
                    </button>
                  ))}
                </div>
              </div>

              <div className="panel-section">
                <h4 className="panel-heading">Approval history</h4>
                <ul className="list-plain text-sm text-[var(--color-muted)]">
                  {selectedRelease.statusHistory.map((entry, index) => (
                    <li key={`${entry.changedAt}-${index}`} className="finding-card">
                      <span className="text-[var(--color-accent-ink)]">{entry.status}</span> ·{" "}
                      {new Date(entry.changedAt).toLocaleString()}
                      {entry.note ? ` — ${entry.note}` : ""}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="panel-section">
                <h4 className="panel-heading">Changelog</h4>
                <pre className="code-block">{selectedRelease.changelogMarkdown}</pre>
              </div>
            </>
          ) : (
            <p className="panel-subtext">Select a release to view details.</p>
          )}
        </Panel>
      </div>
    </PageStack>
  );
}
