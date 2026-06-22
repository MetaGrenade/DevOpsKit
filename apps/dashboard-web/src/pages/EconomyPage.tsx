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

interface EconomyReport {
  profileLabel: string;
  hoursSimulated: number;
  summary: {
    activityCount: number;
    topEarnerNetPerHour: number;
    medianNetPerHour: number;
    totalSinkCostPerHour: number;
    inflationRisk: "low" | "moderate" | "high";
    comparedActivities: number;
  };
  activities: Array<{
    label: string;
    category: string;
    netPerHour: number;
    netForSession: number;
  }>;
  affordability: Array<{
    displayName: string;
    price: number;
    hoursAtMedianIncome: number;
  }>;
}

export default function EconomyPage() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceWithConfig | null>(null);
  const [report, setReport] = useState<EconomyReport | null>(null);
  const [hours, setHours] = useState("4");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function loadData() {
    setLoading(true);
    setMessage(null);

    const wsRes = await fetch("/api/v1/workspaces/active");
    if (wsRes.status === 404) {
      setActiveWorkspace(null);
      setLoading(false);
      return;
    }
    if (!wsRes.ok) {
      setMessage("Failed to load active workspace");
      setLoading(false);
      return;
    }
    setActiveWorkspace((await wsRes.json()) as WorkspaceWithConfig);

    const reportRes = await fetch("/api/v1/reports/economy-simulation");
    if (reportRes.ok) {
      setReport(((await reportRes.json()) as { report: EconomyReport }).report);
    } else {
      setReport(null);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function runSimulation() {
    setBusy(true);
    setMessage(null);
    const parsedHours = Number(hours);
    const response = await fetch("/api/v1/economy/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours: Number.isFinite(parsedHours) && parsedHours > 0 ? parsedHours : 4 }),
    });
    const payload = (await response.json()) as { message?: string; report?: EconomyReport };
    if (!response.ok) {
      setMessage(payload.message ?? "Economy simulation failed");
      setBusy(false);
      return;
    }
    setReport(payload.report ?? null);
    setMessage("Economy simulation complete");
    setBusy(false);
  }

  if (loading) {
    return (
      <PageStack>
        <p className="panel-subtext">Loading economy simulator…</p>
      </PageStack>
    );
  }

  if (!activeWorkspace) {
    return (
      <PageStack>
        <EmptyState
          title="Economy Simulator"
          description="Select an active workspace to compare job, business, and sink balance."
        />
      </PageStack>
    );
  }

  return (
    <PageStack>
      <PageIntro
        title="Economy Simulator"
        description="Compare legal/illegal job income, business revenue, shared sinks, and vehicle affordability from workspace registries."
        actions={
          <div className="btn-row items-end" style={{ marginTop: 0 }}>
            <label className="form-field">
              <span className="form-label">Hours</span>
              <input
                type="number"
                min={1}
                value={hours}
                onChange={(event) => setHours(event.target.value)}
                className="form-control w-24"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void runSimulation()}
              className="btn btn-accent btn-sm"
            >
              {busy ? "Simulating…" : "Run simulation"}
            </button>
          </div>
        }
      />

      <Panel className="panel-compact">
        <p className="panel-subtext">
          CLI: <code className="inline-code">fdt economy simulate --hours 4</code> ·{" "}
          <code className="inline-code">fdt economy report</code>
        </p>
        {message && <PageAlert>{message}</PageAlert>}
      </Panel>

      {report && (
        <>
          <Panel className="panel-compact">
            <h3 className="panel-heading">Summary</h3>
            <p className="panel-subtext">
              Profile {report.profileLabel} · {report.hoursSimulated}h ·{" "}
              {report.summary.comparedActivities} activities compared · inflation risk{" "}
              {report.summary.inflationRisk}
            </p>
            <StatGrid columns={3}>
              <StatTile
                label="Top earner net/hour"
                value={`$${report.summary.topEarnerNetPerHour.toFixed(0)}`}
              />
              <StatTile
                label="Median net/hour"
                value={`$${report.summary.medianNetPerHour.toFixed(0)}`}
              />
              <StatTile
                label="Shared sinks/hour"
                value={`$${report.summary.totalSinkCostPerHour.toFixed(0)}`}
              />
            </StatGrid>
          </Panel>

          <Panel className="panel-compact">
            <h3 className="panel-heading">Income activities</h3>
            <div className="panel-section space-y-2">
              {report.activities.slice(0, 12).map((activity) => (
                <article key={activity.label} className="finding-card text-sm">
                  <div className="font-medium">{activity.label}</div>
                  <div className="text-xs text-[var(--color-muted)]">
                    {activity.category} · ${activity.netPerHour.toFixed(0)}/hr · $
                    {activity.netForSession.toFixed(0)}/session
                  </div>
                </article>
              ))}
            </div>
          </Panel>

          {report.affordability.length > 0 && (
            <Panel className="panel-compact">
              <h3 className="panel-heading">Vehicle affordability</h3>
              <div className="panel-section space-y-2">
                {report.affordability.slice(0, 8).map((entry) => (
                  <article key={entry.displayName} className="finding-card text-sm">
                    <div className="font-medium">{entry.displayName}</div>
                    <div className="text-xs text-[var(--color-muted)]">
                      ${entry.price.toLocaleString()} ·{" "}
                      {Number.isFinite(entry.hoursAtMedianIncome)
                        ? `${entry.hoursAtMedianIncome}h at median income`
                        : "n/a"}
                    </div>
                  </article>
                ))}
              </div>
            </Panel>
          )}
        </>
      )}
    </PageStack>
  );
}
