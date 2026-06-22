import { z } from "zod";

export const EconomyActivityCategorySchema = z.enum([
  "legal_job",
  "illegal_job",
  "business",
  "consumable",
  "vehicle",
  "sink",
  "custom",
]);

export const EconomyActivitySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  category: EconomyActivityCategorySchema,
  incomePerHour: z.number().min(0).default(0),
  costPerHour: z.number().min(0).default(0),
  source: z.enum(["domain", "profile", "derived"]).default("derived"),
  notes: z.string().optional(),
});

export const EconomyProfileSchema = z.object({
  schemaVersion: z.literal(1),
  label: z.string().default("default"),
  paychecksPerHour: z.number().min(0).default(2),
  sessionHours: z.number().min(0).default(4),
  sinks: z
    .object({
      medicalPerSession: z.number().min(0).default(500),
      repairPerSession: z.number().min(0).default(750),
      finesPerSession: z.number().min(0).default(250),
      taxRate: z.number().min(0).max(1).default(0.08),
    })
    .default({}),
  activities: z.array(EconomyActivitySchema).default([]),
});

export const EconomyActivityResultSchema = z.object({
  id: z.string(),
  label: z.string(),
  category: EconomyActivityCategorySchema,
  incomePerHour: z.number(),
  costPerHour: z.number(),
  netPerHour: z.number(),
  netForSession: z.number(),
  source: z.enum(["domain", "profile", "derived"]),
  notes: z.string().optional(),
});

export const EconomySimulationReportSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  workspaceName: z.string(),
  profileLabel: z.string(),
  hoursSimulated: z.number(),
  summary: z.object({
    activityCount: z.number(),
    topEarnerId: z.string().optional(),
    topEarnerNetPerHour: z.number(),
    medianNetPerHour: z.number(),
    totalSinkCostPerHour: z.number(),
    inflationRisk: z.enum(["low", "moderate", "high"]),
    comparedActivities: z.number(),
  }),
  activities: z.array(EconomyActivityResultSchema),
  affordability: z.array(
    z.object({
      vehicleSpawnName: z.string(),
      displayName: z.string(),
      price: z.number(),
      hoursAtMedianIncome: z.number(),
    }),
  ),
});

export type EconomyActivityCategory = z.infer<typeof EconomyActivityCategorySchema>;
export type EconomyActivity = z.infer<typeof EconomyActivitySchema>;
export type EconomyProfile = z.infer<typeof EconomyProfileSchema>;
export type EconomyActivityResult = z.infer<typeof EconomyActivityResultSchema>;
export type EconomySimulationReport = z.infer<typeof EconomySimulationReportSchema>;
