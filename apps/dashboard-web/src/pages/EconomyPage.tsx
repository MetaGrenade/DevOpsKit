import { useEffect, useState } from "react";
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
    return <p className="text-sm text-slate-400">Loading economy simulator…</p>;
  }

  if (!activeWorkspace) {
    return (
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <h2 className="text-xl font-semibold">Economy Simulator</h2>
        <p className="mt-2 text-sm text-slate-400">Select an active workspace to compare job, business, and sink balance.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-[#111831] p-8">
        <h2 className="text-xl font-semibold">Economy Simulator</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          Compare legal/illegal job income, business revenue, shared sinks, and vehicle affordability from workspace registries.
        </p>
        <p className="mt-3 text-sm text-slate-400">
          CLI: <code className="text-slate-200">fdt economy simulate --hours 4</code> ·{" "}
          <code className="text-slate-200">fdt economy report</code>
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm text-slate-300">
            Hours
            <input
              type="number"
              min={1}
              value={hours}
              onChange={(event) => setHours(event.target.value)}
              className="ml-2 rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2 text-sm"
            />
          </label>
          <button type="button" disabled={busy} onClick={() => void runSimulation()} className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-50">
            {busy ? "Simulating…" : "Run simulation"}
          </button>
        </div>
        {message && <p className="mt-4 rounded-lg border border-white/10 bg-[#0b1020] px-4 py-2 text-sm text-slate-200">{message}</p>}
      </section>

      {report && (
        <>
          <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
            <h3 className="text-lg font-semibold">Summary</h3>
            <p className="mt-2 text-sm text-slate-400">
              Profile {report.profileLabel} · {report.hoursSimulated}h · {report.summary.comparedActivities} activities compared · inflation risk {report.summary.inflationRisk}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <article className="rounded-lg border border-white/10 bg-[#0b1020] px-4 py-3 text-sm">
                <div className="text-slate-400">Top earner net/hour</div>
                <div className="mt-1 text-lg font-semibold">${report.summary.topEarnerNetPerHour.toFixed(0)}</div>
              </article>
              <article className="rounded-lg border border-white/10 bg-[#0b1020] px-4 py-3 text-sm">
                <div className="text-slate-400">Median net/hour</div>
                <div className="mt-1 text-lg font-semibold">${report.summary.medianNetPerHour.toFixed(0)}</div>
              </article>
              <article className="rounded-lg border border-white/10 bg-[#0b1020] px-4 py-3 text-sm">
                <div className="text-slate-400">Shared sinks/hour</div>
                <div className="mt-1 text-lg font-semibold">${report.summary.totalSinkCostPerHour.toFixed(0)}</div>
              </article>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
            <h3 className="text-lg font-semibold">Income activities</h3>
            <div className="mt-4 space-y-2">
              {report.activities.slice(0, 12).map((activity) => (
                <article key={activity.label} className="rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2 text-sm">
                  <div className="font-medium">{activity.label}</div>
                  <div className="text-xs text-slate-500">
                    {activity.category} · ${activity.netPerHour.toFixed(0)}/hr · ${activity.netForSession.toFixed(0)}/session
                  </div>
                </article>
              ))}
            </div>
          </section>

          {report.affordability.length > 0 && (
            <section className="rounded-2xl border border-white/10 bg-[#111831] p-6">
              <h3 className="text-lg font-semibold">Vehicle affordability</h3>
              <div className="mt-4 space-y-2">
                {report.affordability.slice(0, 8).map((entry) => (
                  <article key={entry.displayName} className="rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2 text-sm">
                    <div className="font-medium">{entry.displayName}</div>
                    <div className="text-xs text-slate-500">
                      ${entry.price.toLocaleString()} · {Number.isFinite(entry.hoursAtMedianIncome) ? `${entry.hoursAtMedianIncome}h at median income` : "n/a"}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
