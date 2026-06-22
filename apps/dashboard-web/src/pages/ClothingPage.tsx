import { useEffect, useState } from "react";
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

function severityClass(severity: string): string {
  switch (severity) {
    case "error":
      return "text-rose-200 bg-rose-500/15";
    case "warning":
      return "text-amber-200 bg-amber-500/15";
    default:
      return "text-slate-300 bg-slate-500/10";
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
    return <p className="text-sm text-slate-400">Loading clothing packs…</p>;
  }

  if (!activeWorkspace) {
    return (
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <h2 className="text-xl font-semibold">Clothing Pack Manager</h2>
        <p className="mt-2 text-sm text-slate-400">Select an active workspace to manage clothing packs.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <h2 className="text-xl font-semibold">Clothing Pack Manager</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          Catalog clothing resources, index drawable/texture pairs from stream folders, and flag duplicate slot
          assignments or missing previews in{" "}
          <code className="rounded bg-white/5 px-1.5 py-0.5">.fdt/reports/clothing-conflicts.json</code>.
        </p>
        <p className="mt-3 text-sm text-slate-400">
          CLI:{" "}
          <code className="text-slate-200">fdt clothing pack-new --id pack_a --label &quot;Pack A&quot; --resource meta_clothing_a</code>{" "}
          · <code className="text-slate-200">fdt clothing scan</code> ·{" "}
          <code className="text-slate-200">fdt clothing conflicts</code>
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || packs.length === 0}
            onClick={() => void scanPack()}
            className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-200 disabled:opacity-50"
          >
            Scan all packs
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runConflicts()}
            className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-200 disabled:opacity-50"
          >
            Run conflict check
          </button>
        </div>

        {message && (
          <p className="mt-4 rounded-lg border border-white/10 bg-[#0b1020] px-4 py-2 text-sm text-slate-200">
            {message}
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
          <h3 className="font-semibold">New Pack</h3>
          <form className="mt-4 space-y-3 text-sm" onSubmit={createPack}>
            <label className="block">
              <span className="text-slate-400">ID</span>
              <input
                required
                value={packForm.id}
                onChange={(e) => setPackForm({ ...packForm, id: e.target.value })}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-slate-400">Label</span>
              <input
                required
                value={packForm.label}
                onChange={(e) => setPackForm({ ...packForm, label: e.target.value })}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-slate-400">Resource name</span>
              <input
                required
                value={packForm.resourceName}
                onChange={(e) => setPackForm({ ...packForm, resourceName: e.target.value })}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-cyan-500/20 px-4 py-2 font-medium text-cyan-200 disabled:opacity-50"
            >
              Create pack
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
          <h3 className="font-semibold">Packs ({packs.length})</h3>
          <div className="mt-4 space-y-4">
            {packs.length === 0 ? (
              <p className="text-sm text-slate-400">No clothing packs registered yet.</p>
            ) : (
              packs.map((pack) => (
                <article key={pack.id} className="rounded-lg border border-white/10 bg-[#0b1020] p-4 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-cyan-200">{pack.label}</div>
                      <div className="text-xs text-slate-500">
                        {pack.id} · {pack.resourceName} · {pack.status} · {pack.drawables.length} drawables
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void scanPack(pack.id)}
                      className="text-xs text-cyan-300"
                    >
                      Scan
                    </button>
                  </div>
                  {pack.drawables.length > 0 && (
                    <ul className="mt-3 space-y-1 text-xs text-slate-400">
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
        </section>
      </div>

      {report && (
        <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
          <h3 className="font-semibold">Validation findings</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-white/10 bg-[#0b1020] p-3">
              <div className="text-xs text-slate-500">Errors</div>
              <div className="text-xl font-semibold text-rose-300">{report.summary.errors}</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-[#0b1020] p-3">
              <div className="text-xs text-slate-500">Warnings</div>
              <div className="text-xl font-semibold text-amber-300">{report.summary.warnings}</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-[#0b1020] p-3">
              <div className="text-xs text-slate-500">Drawables</div>
              <div className="text-xl font-semibold text-cyan-200">{report.summary.drawablesChecked}</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-[#0b1020] p-3">
              <div className="text-xs text-slate-500">Packs</div>
              <div className="text-xl font-semibold text-slate-200">{report.summary.packsChecked}</div>
            </div>
          </div>

          {report.findings.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Severity</th>
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Message</th>
                    <th className="px-3 py-2">Pack</th>
                  </tr>
                </thead>
                <tbody>
                  {report.findings.map((finding) => (
                    <tr key={finding.id} className="border-t border-white/5">
                      <td className="px-3 py-2">
                        <span className={`rounded px-2 py-0.5 text-xs ${severityClass(finding.severity)}`}>
                          {finding.severity}
                        </span>
                      </td>
                      <td className="px-3 py-2">{finding.code}</td>
                      <td className="px-3 py-2 text-slate-300">{finding.message}</td>
                      <td className="px-3 py-2 text-slate-500">{finding.packId ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-400">No findings — run a conflict check after scanning packs.</p>
          )}
        </section>
      )}
    </div>
  );
}
