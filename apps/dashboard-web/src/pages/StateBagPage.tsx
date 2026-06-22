import { useEffect, useState } from "react";
import {
  EmptyState,
  PageIntro,
  PageStack,
  Panel,
} from "../components/ui/page";
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
    return (
      <PageStack>
        <p className="panel-subtext">Loading state bag snapshots…</p>
      </PageStack>
    );
  }

  if (!activeWorkspace) {
    return (
      <PageStack>
        <EmptyState
          title="State Bag Visualizer"
          description="Select an active workspace to review imported debug snapshots."
        />
      </PageStack>
    );
  }

  return (
    <PageStack>
      <PageIntro
        title="State Bag Visualizer"
        description="Inspect replicated player, vehicle, and entity state bags in-game, then export JSON into this workspace."
      />

      <Panel className="panel-compact">
        <p className="panel-subtext">
          In-game: <code className="inline-code">/fdt_state</code> · CLI import:{" "}
          <code className="inline-code">fdt statebag import ./exports/statebag.json</code>
        </p>
        <p className="panel-subtext">
          Enable <code className="inline-code">Config.PostStateBagToDashboard</code> in{" "}
          <code className="inline-code">fdt_devtools</code> to auto-import exports to{" "}
          <code className="inline-code">/api/v1/statebag/import</code>.
        </p>
      </Panel>

      <Panel className="panel-compact">
        <h3 className="panel-heading">Imported snapshots ({snapshots.length})</h3>
        <div className="panel-section space-y-3">
          {snapshots.length === 0 ? (
            <p className="panel-subtext">No snapshots imported yet.</p>
          ) : (
            snapshots.map((snapshot) => (
              <article
                key={`${snapshot.target.bagName}:${snapshot.exportedAt}`}
                className="finding-card text-sm"
              >
                <div className="font-medium">{snapshot.target.bagName}</div>
                <div className="text-xs text-[var(--color-muted)]">
                  {snapshot.target.kind} · {snapshot.entries.length} entries · {snapshot.exportedAt}
                </div>
                <div className="mt-3 space-y-1">
                  {snapshot.entries.slice(0, 8).map((entry) => (
                    <div key={entry.key} className="font-mono text-xs">
                      {entry.key}: {JSON.stringify(entry.value)}
                    </div>
                  ))}
                </div>
              </article>
            ))
          )}
        </div>
      </Panel>
    </PageStack>
  );
}
