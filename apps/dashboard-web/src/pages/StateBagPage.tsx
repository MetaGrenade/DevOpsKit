import { useEffect, useState } from "react";
import type { WorkspaceWithConfig } from "../types/api";

interface StateBagSnapshot {
  id?: string;
  exportedAt: string;
  target: {
    kind: string;
    bagName: string;
    networkId?: number;
    model?: string;
  };
  entries: Array<{
    key: string;
    value: unknown;
    stale?: boolean;
    updateCount?: number;
  }>;
}

export default function StateBagPage() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceWithConfig | null>(null);
  const [snapshots, setSnapshots] = useState<StateBagSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const wsRes = await fetch("/api/v1/workspaces/active");
      if (wsRes.status === 404) {
        setLoading(false);
        return;
      }
      if (wsRes.ok) {
        setActiveWorkspace((await wsRes.json()) as WorkspaceWithConfig);
      }

      const listRes = await fetch("/api/v1/statebag/snapshots");
      if (listRes.ok) {
        setSnapshots(((await listRes.json()) as { snapshots: StateBagSnapshot[] }).snapshots);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <p className="text-sm text-slate-400">Loading state bag snapshots…</p>;
  }

  if (!activeWorkspace) {
    return (
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <h2 className="text-xl font-semibold">State Bag Visualizer</h2>
        <p className="mt-2 text-sm text-slate-400">Select an active workspace to review imported debug snapshots.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <h2 className="text-xl font-semibold">State Bag Visualizer</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          Inspect replicated player, vehicle, and entity state bags in-game, then export JSON into this workspace.
        </p>
        <p className="mt-3 text-sm text-slate-400">
          In-game: <code className="text-slate-200">/fdt_state</code> · CLI import:{" "}
          <code className="text-slate-200">fdt statebag import ./exports/statebag.json</code>
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Enable `Config.PostStateBagToDashboard` in `fdt_devtools` to auto-import exports to `/api/v1/statebag/import`.
        </p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
        <h3 className="text-lg font-semibold">Imported snapshots ({snapshots.length})</h3>
        <div className="mt-4 space-y-3">
          {snapshots.length === 0 ? (
            <p className="text-sm text-slate-400">No snapshots imported yet.</p>
          ) : (
            snapshots.map((snapshot) => (
              <article key={`${snapshot.target.bagName}:${snapshot.exportedAt}`} className="rounded-lg border border-white/10 bg-[#0b1020] p-4 text-sm">
                <div className="font-medium">{snapshot.target.bagName}</div>
                <div className="text-xs text-slate-500">
                  {snapshot.target.kind} · {snapshot.entries.length} entries · {snapshot.exportedAt}
                </div>
                <div className="mt-3 space-y-1">
                  {snapshot.entries.slice(0, 8).map((entry) => (
                    <div key={entry.key} className="font-mono text-xs text-slate-300">
                      {entry.key}: {JSON.stringify(entry.value)}
                    </div>
                  ))}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
