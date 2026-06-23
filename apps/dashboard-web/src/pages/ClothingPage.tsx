import { useEffect, useState } from "react";
import {
  EmptyState,
  PageAlert,
  PageIntro,
  PageStack,
  Panel,
  StatGrid,
  StatTile,
} from "../components/ui/page";
import type { WorkspaceWithConfig } from "../types/api";

interface ClothingTexture {
  id: string;
  fileName: string;
}

interface ClothingDrawable {
  id: string;
  label?: string;
  category: string;
  gender: string;
  fileName: string;
  previewImage?: string;
  textures: ClothingTexture[];
}

interface ClothingPack {
  id: string;
  label: string;
  resourceName: string;
  status: string;
  genderScope: string;
  drawables: ClothingDrawable[];
  tags: string[];
}

interface ClothingFinding {
  id: string;
  severity: string;
  code: string;
  message: string;
  packId?: string;
  drawableId?: string;
}

interface ClothingReport {
  summary: {
    packsChecked: number;
    drawablesChecked: number;
    errors: number;
    warnings: number;
    info: number;
  };
  findings: ClothingFinding[];
}

const EMPTY_PACK = {
  id: "",
  label: "",
  resourceName: "",
};

function severityBadgeClass(severity: string): string {
  switch (severity) {
    case "error":
      return "finding-badge finding-badge-error";
    case "warning":
      return "finding-badge finding-badge-warning";
    default:
      return "finding-badge finding-badge-info";
  }
}

export default function ClothingPage() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceWithConfig | null>(null);
  const [packs, setPacks] = useState<ClothingPack[]>([]);
  const [report, setReport] = useState<ClothingReport | null>(null);
  const [packForm, setPackForm] = useState(EMPTY_PACK);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function loadData() {
    setLoading(true);
    setMessage(null);

    try {
      const wsRes = await fetch("/api/v1/workspaces/active");
      if (wsRes.status === 404) {
        setActiveWorkspace(null);
        setPacks([]);
        setReport(null);
        return;
      }
      if (!wsRes.ok) throw new Error("Failed to load active workspace");
      setActiveWorkspace((await wsRes.json()) as WorkspaceWithConfig);

      const packsRes = await fetch("/api/v1/clothing/packs");
      if (packsRes.ok) {
        setPacks(((await packsRes.json()) as { packs: ClothingPack[] }).packs);
      }

      const reportRes = await fetch("/api/v1/reports/clothing-conflicts");
      if (reportRes.ok) {
        setReport(((await reportRes.json()) as { report: ClothingReport }).report);
      } else {
        setReport(null);
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

  async function createPack(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    const response = await fetch("/api/v1/clothing/packs/new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(packForm),
    });

    const payload = (await response.json()) as { message?: string };
    if (!response.ok) {
      setMessage(payload.message ?? "Failed to create clothing pack");
      setBusy(false);
      return;
    }

    setPackForm(EMPTY_PACK);
    setMessage(`Created clothing pack ${packForm.id}`);
    await loadData();
    setBusy(false);
  }

  async function scanPack(packId?: string) {
    setBusy(true);
    setMessage(null);

    const response = await fetch("/api/v1/clothing/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(packId ? { packId } : {}),
    });

    const payload = (await response.json()) as { message?: string; results?: Array<{ pack: ClothingPack }> };
    if (!response.ok) {
      setMessage(payload.message ?? "Scan failed");
      setBusy(false);
      return;
    }

    const indexed = payload.results?.reduce((sum, item) => sum + item.pack.drawables.length, 0) ?? 0;
    setMessage(`Scan complete — ${indexed} drawables indexed`);
    await loadData();
    setBusy(false);
  }

  async function runConflicts() {
    setBusy(true);
    setMessage(null);

    const response = await fetch("/api/v1/clothing/conflicts", { method: "POST" });
    const payload = (await response.json()) as { message?: string; report?: ClothingReport };
    if (!response.ok) {
      setMessage(payload.message ?? "Conflict check failed");
      setBusy(false);
      return;
    }

    setReport(payload.report ?? null);
    setMessage(
      `Conflict check complete — ${payload.report?.summary.errors ?? 0} errors, ${payload.report?.summary.warnings ?? 0} warnings`,
    );
    setBusy(false);
  }

  if (loading) {
    return (
      <PageStack>
        <p className="panel-subtext">Loading clothing packs…</p>
      </PageStack>
    );
  }

  if (!activeWorkspace) {
    return (
      <PageStack>
        <EmptyState
          title="Clothing Pack Manager"
          description="Select an active workspace to manage clothing packs."
          variant="workspace"
        />
      </PageStack>
    );
  }

  return (
    <PageStack>
      <PageIntro
        title="Clothing Pack Manager"
        description={
          <>
            Catalog clothing resources, index drawable/texture pairs from stream folders, and flag duplicate slot
            assignments or missing previews in{" "}
            <code className="inline-code">.fdt/reports/clothing-conflicts.json</code>.
          </>
        }
        actions={
          <div className="btn-row" style={{ marginTop: 0 }}>
            <button
              type="button"
              disabled={busy || packs.length === 0}
              onClick={() => void scanPack()}
              className="btn btn-accent btn-sm"
            >
              Scan all packs
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void runConflicts()}
              className="btn btn-secondary btn-sm"
            >
              Run conflict check
            </button>
          </div>
        }
      />

      <Panel className="panel-compact">
        <p className="panel-subtext">
          CLI:{" "}
          <code className="inline-code">fdt clothing pack-new --id pack_a --label &quot;Pack A&quot; --resource meta_clothing_a</code>{" "}
          · <code className="inline-code">fdt clothing scan</code> ·{" "}
          <code className="inline-code">fdt clothing conflicts</code>
        </p>
        {message && <PageAlert>{message}</PageAlert>}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Panel className="panel-compact">
          <h3 className="panel-heading">New Pack</h3>
          <form className="form-stack panel-section" onSubmit={createPack}>
            <label className="form-field">
              <span className="form-label">ID</span>
              <input
                required
                value={packForm.id}
                onChange={(e) => setPackForm({ ...packForm, id: e.target.value })}
                className="form-control"
              />
            </label>
            <label className="form-field">
              <span className="form-label">Label</span>
              <input
                required
                value={packForm.label}
                onChange={(e) => setPackForm({ ...packForm, label: e.target.value })}
                className="form-control"
              />
            </label>
            <label className="form-field">
              <span className="form-label">Resource name</span>
              <input
                required
                value={packForm.resourceName}
                onChange={(e) => setPackForm({ ...packForm, resourceName: e.target.value })}
                className="form-control"
              />
            </label>
            <button type="submit" disabled={busy} className="btn btn-accent btn-sm">
              Create pack
            </button>
          </form>
        </Panel>

        <Panel className="panel-compact">
          <h3 className="panel-heading">Packs ({packs.length})</h3>
          <div className="panel-section space-y-3">
            {packs.length === 0 ? (
              <p className="panel-subtext">No clothing packs registered yet.</p>
            ) : (
              packs.map((pack) => (
                <article key={pack.id} className="finding-card text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{pack.label}</div>
                      <div className="text-xs text-[var(--color-muted)]">
                        {pack.id} · {pack.resourceName} · {pack.status} · {pack.drawables.length} drawables
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void scanPack(pack.id)}
                      className="btn btn-secondary btn-sm"
                    >
                      Scan
                    </button>
                  </div>
                  {pack.drawables.length > 0 && (
                    <ul className="list-plain mt-2 text-xs text-[var(--color-muted)]">
                      {pack.drawables.slice(0, 5).map((drawable) => (
                        <li key={drawable.id}>
                          {drawable.label ?? drawable.fileName} · {drawable.category} · {drawable.gender} ·{" "}
                          {drawable.textures.length} textures
                          {!drawable.previewImage ? " · no preview" : ""}
                        </li>
                      ))}
                      {pack.drawables.length > 5 && (
                        <li>…and {pack.drawables.length - 5} more drawables</li>
                      )}
                    </ul>
                  )}
                </article>
              ))
            )}
          </div>
        </Panel>
      </div>

      {report && (
        <Panel className="panel-compact">
          <h3 className="panel-heading">Validation findings</h3>
          <StatGrid columns={4}>
            <StatTile label="Errors" value={report.summary.errors} tone="danger" />
            <StatTile label="Warnings" value={report.summary.warnings} tone="warning" />
            <StatTile label="Drawables" value={report.summary.drawablesChecked} />
            <StatTile label="Packs" value={report.summary.packsChecked} tone="muted" />
          </StatGrid>

          {report.findings.length > 0 ? (
            <div className="panel-section data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Code</th>
                    <th>Message</th>
                    <th>Pack</th>
                  </tr>
                </thead>
                <tbody>
                  {report.findings.map((finding) => (
                    <tr key={finding.id}>
                      <td>
                        <span className={severityBadgeClass(finding.severity)}>{finding.severity}</span>
                      </td>
                      <td>{finding.code}</td>
                      <td>{finding.message}</td>
                      <td className="text-[var(--color-muted)]">{finding.packId ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="panel-subtext panel-section">No findings — run a conflict check after scanning packs.</p>
          )}
        </Panel>
      )}
    </PageStack>
  );
}
