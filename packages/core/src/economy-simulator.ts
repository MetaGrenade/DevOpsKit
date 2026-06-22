import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type {
  EconomyActivity,
  EconomyActivityResult,
  EconomyProfile,
  EconomySimulationReport,
  FdtDomainModel,
} from "@fdt/schemas";
import { EconomyProfileSchema, EconomySimulationReportSchema } from "@fdt/schemas";
import { loadDomainModel } from "./domain-model.js";
import {
  FDT_ECONOMY_MARKDOWN,
  FDT_ECONOMY_PROFILE_FILE,
  FDT_ECONOMY_SIMULATION_REPORT,
} from "./workspace.js";

function defaultProfile(): EconomyProfile {
  return EconomyProfileSchema.parse({
    schemaVersion: 1,
    label: "default",
  });
}

export function resolveEconomyProfilePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, FDT_ECONOMY_PROFILE_FILE);
}

export async function loadEconomyProfile(workspaceRoot: string): Promise<EconomyProfile> {
  const profilePath = resolveEconomyProfilePath(workspaceRoot);
  if (!existsSync(profilePath)) {
    return defaultProfile();
  }

  const raw = await readFile(profilePath, "utf8");
  return EconomyProfileSchema.parse(JSON.parse(raw));
}

export async function saveEconomyProfile(workspaceRoot: string, profile: EconomyProfile): Promise<string> {
  const profilePath = resolveEconomyProfilePath(workspaceRoot);
  await mkdir(path.dirname(profilePath), { recursive: true });
  await writeFile(profilePath, `${JSON.stringify(EconomyProfileSchema.parse(profile), null, 2)}\n`, "utf8");
  return profilePath;
}

function jobCategory(type: string): EconomyActivity["category"] {
  if (type === "criminal") {
    return "illegal_job";
  }
  return "legal_job";
}

export function deriveEconomyActivities(model: FdtDomainModel, profile: EconomyProfile): EconomyActivity[] {
  const byId = new Map<string, EconomyActivity>();

  for (const job of model.jobs) {
    for (const grade of job.grades) {
      const id = `job:${job.id}:${grade.level}`;
      byId.set(id, {
        id,
        label: `${job.label} · ${grade.label}`,
        category: jobCategory(job.type),
        incomePerHour: grade.payment * profile.paychecksPerHour,
        costPerHour: 0,
        source: "domain",
        notes: `Derived from job grade payment (${grade.payment} per paycheck)`,
      });
    }
  }

  for (const business of model.businesses) {
    const revenuePerHour =
      typeof business.metadata.revenuePerHour === "number"
        ? business.metadata.revenuePerHour
        : business.type === "shop"
          ? 1200
          : business.type === "stash"
            ? 0
            : 800;

    byId.set(`business:${business.id}`, {
      id: `business:${business.id}`,
      label: business.label,
      category: "business",
      incomePerHour: revenuePerHour,
      costPerHour: 0,
      source: "domain",
      notes: "Business revenue estimate from registry metadata or type defaults",
    });
  }

  for (const item of model.items) {
    const price = item.economy?.basePrice ?? item.economy?.sellPrice;
    if (price === undefined || price <= 0) {
      continue;
    }

    byId.set(`item:${item.id}`, {
      id: `item:${item.id}`,
      label: item.label,
      category: "consumable",
      incomePerHour: 0,
      costPerHour: price / Math.max(profile.sessionHours, 1),
      source: "domain",
      notes: "Consumable cost spread across a session",
    });
  }

  if (byId.size < 3) {
    for (const fallback of [
      {
        id: "fallback:delivery",
        label: "Delivery loop (baseline)",
        category: "legal_job" as const,
        incomePerHour: 1800,
      },
      {
        id: "fallback:mining",
        label: "Mining loop (baseline)",
        category: "legal_job" as const,
        incomePerHour: 2200,
      },
      {
        id: "fallback:contraband",
        label: "Contraband run (baseline)",
        category: "illegal_job" as const,
        incomePerHour: 3200,
      },
    ]) {
      if (!byId.has(fallback.id)) {
        byId.set(fallback.id, {
          ...fallback,
          costPerHour: 0,
          source: "derived",
          notes: "Baseline activity used when workspace data is sparse",
        });
      }
    }
  }

  for (const activity of profile.activities) {
    byId.set(activity.id, { ...activity, source: "profile" });
  }

  return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function assessInflationRisk(topNet: number, medianNet: number, sinkPerHour: number): "low" | "moderate" | "high" {
  if (medianNet <= 0) {
    return "high";
  }
  const spread = topNet / medianNet;
  const sinkRatio = sinkPerHour / medianNet;
  if (spread > 4 || sinkRatio > 0.45) {
    return "high";
  }
  if (spread > 2.5 || sinkRatio > 0.25) {
    return "moderate";
  }
  return "low";
}

export function simulateEconomy(options: {
  workspaceName: string;
  profile: EconomyProfile;
  model: FdtDomainModel;
  hours?: number;
}): EconomySimulationReport {
  const hoursSimulated = options.hours ?? options.profile.sessionHours;
  const activities = deriveEconomyActivities(options.model, options.profile);

  const sinkPerHour =
    (options.profile.sinks.medicalPerSession +
      options.profile.sinks.repairPerSession +
      options.profile.sinks.finesPerSession) /
    Math.max(hoursSimulated, 1);

  const activityResults: EconomyActivityResult[] = activities.map((activity) => {
    const taxedIncome = activity.incomePerHour * (1 - options.profile.sinks.taxRate);
    const netPerHour = taxedIncome - activity.costPerHour - sinkPerHour;
    return {
      id: activity.id,
      label: activity.label,
      category: activity.category,
      incomePerHour: activity.incomePerHour,
      costPerHour: activity.costPerHour + sinkPerHour,
      netPerHour,
      netForSession: netPerHour * hoursSimulated,
      source: activity.source,
      notes: activity.notes,
    };
  });

  const earners = activityResults.filter((activity) => activity.netPerHour > 0);
  const sorted = [...earners].sort((a, b) => b.netPerHour - a.netPerHour);
  const top = sorted[0];
  const medianNet = median(earners.map((activity) => activity.netPerHour));

  const affordability = options.model.vehicles
    .filter((vehicle) => vehicle.price !== undefined && vehicle.price > 0)
    .map((vehicle) => ({
      vehicleSpawnName: vehicle.spawnName,
      displayName: vehicle.displayName,
      price: vehicle.price!,
      hoursAtMedianIncome: medianNet > 0 ? Number((vehicle.price! / medianNet).toFixed(1)) : Infinity,
    }))
    .sort((a, b) => a.hoursAtMedianIncome - b.hoursAtMedianIncome);

  return EconomySimulationReportSchema.parse({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    workspaceName: options.workspaceName,
    profileLabel: options.profile.label,
    hoursSimulated,
    summary: {
      activityCount: activityResults.length,
      topEarnerId: top?.id,
      topEarnerNetPerHour: top?.netPerHour ?? 0,
      medianNetPerHour: Number(medianNet.toFixed(2)),
      totalSinkCostPerHour: Number(sinkPerHour.toFixed(2)),
      inflationRisk: assessInflationRisk(top?.netPerHour ?? 0, medianNet, sinkPerHour),
      comparedActivities: Math.max(sorted.length, 3),
    },
    activities: activityResults.sort((a, b) => b.netPerHour - a.netPerHour),
    affordability,
  });
}

export async function runEconomySimulation(options: {
  workspaceRoot: string;
  workspaceName: string;
  hours?: number;
  profile?: EconomyProfile;
}): Promise<EconomySimulationReport> {
  const [model, profile] = await Promise.all([
    loadDomainModel(options.workspaceRoot),
    options.profile ? Promise.resolve(options.profile) : loadEconomyProfile(options.workspaceRoot),
  ]);

  return simulateEconomy({
    workspaceName: options.workspaceName,
    profile,
    model,
    hours: options.hours,
  });
}

export async function saveEconomySimulationReport(
  workspaceRoot: string,
  report: EconomySimulationReport,
): Promise<string> {
  const reportPath = path.join(workspaceRoot, FDT_ECONOMY_SIMULATION_REPORT);
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

export async function loadEconomySimulationReport(workspaceRoot: string): Promise<EconomySimulationReport | null> {
  const reportPath = path.join(workspaceRoot, FDT_ECONOMY_SIMULATION_REPORT);
  if (!existsSync(reportPath)) {
    return null;
  }
  return EconomySimulationReportSchema.parse(JSON.parse(await readFile(reportPath, "utf8")));
}

export function renderEconomyMarkdown(report: EconomySimulationReport): string {
  const lines = [
    `# Economy Simulation — ${report.workspaceName}`,
    "",
    `- Profile: **${report.profileLabel}**`,
    `- Hours simulated: **${report.hoursSimulated}**`,
    `- Activities compared: **${report.summary.comparedActivities}**`,
    `- Median net/hour: **$${report.summary.medianNetPerHour.toLocaleString()}**`,
    `- Top earner net/hour: **$${report.summary.topEarnerNetPerHour.toLocaleString()}**`,
    `- Shared sink cost/hour: **$${report.summary.totalSinkCostPerHour.toLocaleString()}**`,
    `- Inflation risk: **${report.summary.inflationRisk}**`,
    "",
    "## Income activities",
    "",
    "| Activity | Category | Net/hour | Net/session |",
    "| --- | --- | ---: | ---: |",
  ];

  for (const activity of report.activities.slice(0, 12)) {
    lines.push(
      `| ${activity.label} | ${activity.category} | $${activity.netPerHour.toFixed(0)} | $${activity.netForSession.toFixed(0)} |`,
    );
  }

  if (report.affordability.length > 0) {
    lines.push("", "## Vehicle affordability (at median income)", "", "| Vehicle | Price | Hours to afford |", "| --- | ---: | ---: |");
    for (const entry of report.affordability.slice(0, 10)) {
      const hours =
        Number.isFinite(entry.hoursAtMedianIncome) && entry.hoursAtMedianIncome !== Infinity
          ? entry.hoursAtMedianIncome.toString()
          : "n/a";
      lines.push(`| ${entry.displayName} | $${entry.price.toLocaleString()} | ${hours} |`);
    }
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

export async function writeEconomyMarkdownReport(workspaceRoot: string, report: EconomySimulationReport): Promise<string> {
  const markdownPath = path.join(workspaceRoot, FDT_ECONOMY_MARKDOWN);
  await mkdir(path.dirname(markdownPath), { recursive: true });
  await writeFile(markdownPath, renderEconomyMarkdown(report), "utf8");
  return markdownPath;
}
