import type { FastifyInstance } from "fastify";
import { OPENAPI_SPEC } from "./spec.js";

const SWAGGER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FDT Dashboard API</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: "/api/v1/openapi.json",
      dom_id: "#swagger-ui",
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis],
    });
  </script>
</body>
</html>`;

export async function registerOpenApiRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/openapi.json", async () => OPENAPI_SPEC);

  app.get("/api/v1/docs", async (_request, reply) => {
    reply.type("text/html").send(SWAGGER_HTML);
  });
}
