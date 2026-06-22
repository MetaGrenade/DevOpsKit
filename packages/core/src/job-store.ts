import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  JobRegistrySchema,
  JobSchema,
  JobTypeSchema,
  ZonePurposeSchema,
  type Job,
  type JobRegistry,
  type Zone,
} from "@fdt/schemas";
import { FDT_JOBS_FILE } from "./workspace.js";
import { loadZoneRegistry } from "./zone-store.js";

function emptyRegistry(): JobRegistry {
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    jobs: [],
  };
}

export function resolveJobsPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, FDT_JOBS_FILE);
}

export async function loadJobRegistry(workspaceRoot: string): Promise<JobRegistry> {
  const jobsPath = resolveJobsPath(workspaceRoot);
  if (!existsSync(jobsPath)) {
    return emptyRegistry();
  }

  const raw = await readFile(jobsPath, "utf8");
  return JobRegistrySchema.parse(JSON.parse(raw));
}

export async function saveJobRegistry(workspaceRoot: string, registry: JobRegistry): Promise<string> {
  const jobsPath = resolveJobsPath(workspaceRoot);
  await mkdir(path.dirname(jobsPath), { recursive: true });

  const payload: JobRegistry = {
    ...registry,
    updatedAt: new Date().toISOString(),
  };

  await writeFile(jobsPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return jobsPath;
}

export async function listJobs(workspaceRoot: string): Promise<Job[]> {
  const registry = await loadJobRegistry(workspaceRoot);
  return registry.jobs;
}

export async function upsertJob(workspaceRoot: string, job: Job): Promise<Job> {
  const parsed = JobSchema.parse(job);
  const registry = await loadJobRegistry(workspaceRoot);
  const index = registry.jobs.findIndex((existing) => existing.id === parsed.id);

  if (index >= 0) {
    registry.jobs[index] = parsed;
  } else {
    registry.jobs.push(parsed);
  }

  registry.jobs.sort((a, b) => a.id.localeCompare(b.id));
  await saveJobRegistry(workspaceRoot, registry);
  return parsed;
}

export async function deleteJob(workspaceRoot: string, jobId: string): Promise<boolean> {
  const registry = await loadJobRegistry(workspaceRoot);
  const before = registry.jobs.length;
  registry.jobs = registry.jobs.filter((job) => job.id !== jobId);

  if (registry.jobs.length === before) {
    return false;
  }

  await saveJobRegistry(workspaceRoot, registry);
  return true;
}

const PURPOSE_TO_JOB_TYPE: Record<string, Job["type"]> = {
  job: "business",
  shop: "business",
  stash: "business",
  garage: "business",
  territory: "criminal",
  interaction: "custom",
  event: "custom",
  custom: "custom",
};

export function mapZonePurposeToJobType(purpose: Zone["purpose"]): Job["type"] {
  const parsed = ZonePurposeSchema.parse(purpose);
  return PURPOSE_TO_JOB_TYPE[parsed] ?? "custom";
}

export async function createJobFromZone(
  workspaceRoot: string,
  input: {
    zoneId: string;
    id?: string;
    label?: string;
    type?: Job["type"];
    defaultDuty?: boolean;
  },
): Promise<Job> {
  const zones = await loadZoneRegistry(workspaceRoot);
  const zone = zones.zones.find((item) => item.id === input.zoneId);
  if (!zone) {
    throw new Error(`Zone not found: ${input.zoneId}`);
  }

  const jobId = input.id ?? `job_${zone.id}`;
  const jobType = input.type ?? mapZonePurposeToJobType(zone.purpose);
  JobTypeSchema.parse(jobType);

  const coord = zone.coords[0];
  const job = JobSchema.parse({
    id: jobId,
    label: input.label ?? zone.label,
    type: jobType,
    defaultDuty: input.defaultDuty ?? zone.purpose === "job",
    zoneId: zone.id,
    grades: [{ id: "grade_0", level: 0, label: "Employee", payment: 0 }],
    locations: coord
      ? [
          {
            type: zone.purpose === "job" ? "duty" : "shop",
            coords: { x: coord.x, y: coord.y, z: coord.z },
            radius: zone.radius,
            metadata: { sourceZonePurpose: zone.purpose },
          },
        ]
      : [],
    metadata: {
      sourceZonePurpose: zone.purpose,
      zoneType: zone.type,
    },
  });

  return upsertJob(workspaceRoot, job);
}
