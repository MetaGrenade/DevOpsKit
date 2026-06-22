import { z } from "zod";

export const JobTypeSchema = z.enum([
  "civilian",
  "government",
  "public_safety",
  "criminal",
  "business",
  "custom",
]);

export const JobLocationTypeSchema = z.enum([
  "duty",
  "boss",
  "stash",
  "garage",
  "shop",
  "crafting",
  "wardrobe",
]);

export const JobGradeSchema = z.object({
  id: z.string().min(1),
  level: z.number().int().min(0),
  label: z.string().min(1),
  payment: z.number().min(0).default(0),
  permissions: z.array(z.string()).default([]),
});

export const JobLocationSchema = z.object({
  type: JobLocationTypeSchema,
  coords: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
    w: z.number().optional(),
  }),
  radius: z.number().min(0).optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const JobSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_]+$/, "Job id must use lowercase letters, numbers, and underscores"),
  label: z.string().min(1),
  type: JobTypeSchema.default("custom"),
  defaultDuty: z.boolean().default(false),
  zoneId: z.string().optional(),
  grades: z.array(JobGradeSchema).default([]),
  locations: z.array(JobLocationSchema).default([]),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const JobRegistrySchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string(),
  jobs: z.array(JobSchema).default([]),
});

export type JobType = z.infer<typeof JobTypeSchema>;
export type JobLocationType = z.infer<typeof JobLocationTypeSchema>;
export type JobGrade = z.infer<typeof JobGradeSchema>;
export type JobLocation = z.infer<typeof JobLocationSchema>;
export type Job = z.infer<typeof JobSchema>;
export type JobRegistry = z.infer<typeof JobRegistrySchema>;
