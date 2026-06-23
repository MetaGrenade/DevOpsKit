import type { FastifyInstance } from "fastify";
import { existsSync } from "node:fs";
import path from "node:path";
import { getActiveWorkspaceDirectory } from "../workspaces/service.js";
import { SEARCH_CATALOG, type SearchCatalogEntry } from "./catalog.js";

export interface SearchResult {
  id: string;
  type: SearchCatalogEntry["type"];
  label: string;
  description: string;
  group: string;
  page?: string;
  available?: boolean;
  actionMethod?: "POST";
  actionPath?: string;
}

function matchesQuery(entry: SearchCatalogEntry, normalized: string): boolean {
  if (!normalized) {
    return true;
  }
  return [entry.label, entry.description, entry.group, ...entry.keywords, entry.id]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

async function enrichEntry(
  entry: SearchCatalogEntry,
  activeDirectory: string | null,
): Promise<SearchResult> {
  const result: SearchResult = {
    id: entry.id,
    type: entry.type,
    label: entry.label,
    description: entry.description,
    group: entry.group,
    page: entry.page,
    actionMethod: entry.actionMethod,
    actionPath: entry.actionPath,
  };

  if (entry.type === "report" && entry.reportPath) {
    result.available = activeDirectory
      ? existsSync(path.join(activeDirectory, entry.reportPath))
      : false;
  }

  return result;
}

export async function registerSearchRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { q?: string } }>("/api/v1/search", async (request) => {
    const normalized = (request.query.q ?? "").trim().toLowerCase();
    const activeDirectory = await getActiveWorkspaceDirectory();
    const filtered = SEARCH_CATALOG.filter((entry) => matchesQuery(entry, normalized));
    const results = await Promise.all(filtered.map((entry) => enrichEntry(entry, activeDirectory)));
    return { query: request.query.q ?? "", results };
  });
}
