import type { FastifyInstance } from "fastify";
import { getAdapter, getRecommendedAdapterId, listAdapters } from "@fdt/adapters";
import {
  deleteCraftingRecipe,
  deleteItem,
  deleteShop,
  listCraftingRecipes,
  listItems,
  listShops,
  loadContentRegistry,
  loadDomainModel,
  toDomainModel,
  upsertCraftingRecipe,
  upsertItem,
  upsertShop,
} from "@fdt/core";
import { AdapterIdSchema, CraftingRecipeSchema, ItemSchema, ShopSchema } from "@fdt/schemas";
import { validateContent } from "@fdt/validators";
import { getActiveWorkspace } from "../workspaces/service.js";

async function requireActiveWorkspace() {
  const active = await getActiveWorkspace();
  if (!active) {
    return null;
  }
  return active;
}

export async function registerContentRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/content/items", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    const items = await listItems(active.directory);
    return { items };
  });

  app.post("/api/v1/content/items", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    const parsed = ItemSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_input",
        message: parsed.error.message,
      });
    }

    const item = await upsertItem(active.directory, parsed.data);
    return { status: "saved", item };
  });

  app.delete("/api/v1/content/items/:id", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    const { id } = request.params as { id: string };
    const removed = await deleteItem(active.directory, id);
    if (!removed) {
      return reply.status(404).send({
        error: "not_found",
        message: `Item not found: ${id}`,
      });
    }

    return { status: "removed", id };
  });

  app.get("/api/v1/content/shops", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    const shops = await listShops(active.directory);
    return { shops };
  });

  app.post("/api/v1/content/shops", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    const parsed = ShopSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_input",
        message: parsed.error.message,
      });
    }

    const shop = await upsertShop(active.directory, parsed.data);
    return { status: "saved", shop };
  });

  app.delete("/api/v1/content/shops/:id", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    const { id } = request.params as { id: string };
    const removed = await deleteShop(active.directory, id);
    if (!removed) {
      return reply.status(404).send({
        error: "not_found",
        message: `Shop not found: ${id}`,
      });
    }

    return { status: "removed", id };
  });

  app.get("/api/v1/content/crafting", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    const recipes = await listCraftingRecipes(active.directory);
    return { recipes };
  });

  app.post("/api/v1/content/crafting", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    const parsed = CraftingRecipeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_input",
        message: parsed.error.message,
      });
    }

    const recipe = await upsertCraftingRecipe(active.directory, parsed.data);
    return { status: "saved", recipe };
  });

  app.delete("/api/v1/content/crafting/:id", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    const { id } = request.params as { id: string };
    const removed = await deleteCraftingRecipe(active.directory, id);
    if (!removed) {
      return reply.status(404).send({
        error: "not_found",
        message: `Crafting recipe not found: ${id}`,
      });
    }

    return { status: "removed", id };
  });

  app.get("/api/v1/content/adapters", async () => {
    const active = await requireActiveWorkspace();
    const recommended = active?.frameworkProfile?.recommendedAdapters ?? ["custom-json"];
    const recommendedAdapter = getRecommendedAdapterId(recommended);

    return {
      adapters: listAdapters().map((adapter) => ({
        id: adapter.id,
        label: adapter.label,
        version: adapter.version,
        capabilities: adapter.capabilities,
        recommended: adapter.id === recommendedAdapter,
      })),
      frameworkProfile: active?.frameworkProfile ?? null,
      recommendedAdapter,
    };
  });

  app.post("/api/v1/content/validate", async (_request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    const report = await validateContent({
      workspaceRoot: active.directory,
      workspaceName: active.workspace.name,
    });

    return { status: "validated", report };
  });

  app.post("/api/v1/content/export", async (request, reply) => {
    const active = await requireActiveWorkspace();
    if (!active) {
      return reply.status(404).send({
        error: "not_found",
        message: "No active workspace selected.",
      });
    }

    const body = request.body as { adapter?: string; dryRun?: boolean };
    const adapterId = AdapterIdSchema.safeParse(body.adapter);
    if (!adapterId.success) {
      return reply.status(400).send({
        error: "invalid_input",
        message: "adapter must be one of: custom-json, qbcore, qbox, esx, ox-inventory",
      });
    }

    const adapter = getAdapter(adapterId.data);
    const model =
      adapterId.data === "custom-json"
        ? await loadDomainModel(active.directory)
        : toDomainModel(await loadContentRegistry(active.directory));
    const includeOxInventory =
      adapterId.data === "esx" && active.frameworkProfile?.inventory === "ox-inventory";
    const result = await adapter.export(model, {
      dryRun: body.dryRun ?? true,
      includeOxInventory,
    });

    return {
      status: body.dryRun === false ? "exported" : "preview",
      adapterId: adapter.id,
      files: result.files,
    };
  });
}
