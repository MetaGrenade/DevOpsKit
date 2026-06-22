import type { FastifyInstance } from "fastify";
import { browseDirectory, getFilesystemRoots, type BrowseMode } from "./browse.js";

function parseExtensions(raw?: string): string[] | undefined {
  if (!raw) {
    return undefined;
  }

  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export async function registerFilesystemRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/fs/roots", async () => ({
    roots: getFilesystemRoots(),
  }));

  app.get("/api/v1/fs/list", async (request, reply) => {
    const query = request.query as {
      path?: string;
      mode?: BrowseMode;
      extensions?: string;
    };

    const mode = query.mode ?? "directory";

    try {
      const listing = await browseDirectory(query.path, mode, parseExtensions(query.extensions));
      return listing;
    } catch (error) {
      return reply.status(404).send({
        error: "browse_failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
