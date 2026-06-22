import type { FastifyInstance } from "fastify";

export interface ListenWithRetryOptions {
  port: number;
  host: string;
  maxAttempts?: number;
  baseDelayMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAddrInUse(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "EADDRINUSE"
  );
}

export async function listenWithRetry(
  app: FastifyInstance,
  options: ListenWithRetryOptions,
): Promise<void> {
  const maxAttempts = options.maxAttempts ?? 12;
  const baseDelayMs = options.baseDelayMs ?? 300;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await app.listen({ port: options.port, host: options.host });
      return;
    } catch (error) {
      if (!isAddrInUse(error) || attempt === maxAttempts) {
        if (isAddrInUse(error)) {
          throw new Error(
            `Port ${options.port} is already in use after ${maxAttempts} retries. Stop the other process or run: pnpm dev:clean`,
            { cause: error },
          );
        }
        throw error;
      }

      const delayMs = baseDelayMs * attempt;
      console.warn(
        `Port ${options.port} is still in use; waiting ${delayMs}ms before retry (${attempt}/${maxAttempts})...`,
      );
      await sleep(delayMs);
    }
  }
}
