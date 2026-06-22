import { z } from "zod";

export const CraftingInputSchema = z.object({
  itemId: z.string().min(1),
  amount: z.number().int().min(1).default(1),
});

export const CraftingOutputSchema = z.object({
  itemId: z.string().min(1),
  amount: z.number().int().min(1).default(1),
});

export const CraftingRecipeSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_]+$/, "Recipe id must use lowercase letters, numbers, and underscores"),
  label: z.string().min(1),
  bench: z.string().optional(),
  durationSeconds: z.number().min(0).optional(),
  jobId: z.string().optional(),
  gangId: z.string().optional(),
  minGrade: z.number().int().min(0).optional(),
  inputs: z.array(CraftingInputSchema).min(1),
  outputs: z.array(CraftingOutputSchema).min(1),
  metadata: z.record(z.unknown()).default({}),
});

export const CraftingRegistrySchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string(),
  recipes: z.array(CraftingRecipeSchema).default([]),
});

export type CraftingInput = z.infer<typeof CraftingInputSchema>;
export type CraftingOutput = z.infer<typeof CraftingOutputSchema>;
export type CraftingRecipe = z.infer<typeof CraftingRecipeSchema>;
export type CraftingRegistry = z.infer<typeof CraftingRegistrySchema>;
