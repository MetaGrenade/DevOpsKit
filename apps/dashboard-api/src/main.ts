import "./load-env.js";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import { listenWithRetry } from "./listen-with-retry.js";

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";
const SHUTDOWN_TIMEOUT_MS = 5000;

let app: FastifyInstance | undefined;
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  console.log(`Received ${signal}, shutting down dashboard-api...`);

  const forceExitTimer = setTimeout(() => {
    console.error("Shutdown timed out, forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExitTimer.unref();

  try {
    if (app) {
      await app.close();
      app = undefined;
    }
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exitCode = 1;
  } finally {
    clearTimeout(forceExitTimer);
    process.exit(process.exitCode ?? 0);
  }
}

async function main() {
  app = await buildApp();
  await listenWithRetry(app, { port: PORT, host: HOST });
  console.log(`dashboard-api listening on http://${HOST}:${PORT}`);
}

const shutdownSignals: NodeJS.Signals[] =
  process.platform === "win32" ? ["SIGTERM", "SIGINT", "SIGBREAK"] : ["SIGTERM", "SIGINT"];

for (const signal of shutdownSignals) {
  process.once(signal, () => void shutdown(signal));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
