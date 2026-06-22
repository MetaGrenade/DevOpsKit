import { z } from "zod";

export const FrameworkTargetSchema = z.enum(["custom", "qbcore", "qbox", "esx", "ox"]);

export const InventorySystemSchema = z.enum(["custom", "qbcore", "ox-inventory", "esx"]);

export type FrameworkTarget = z.infer<typeof FrameworkTargetSchema>;
export type InventorySystem = z.infer<typeof InventorySystemSchema>;
