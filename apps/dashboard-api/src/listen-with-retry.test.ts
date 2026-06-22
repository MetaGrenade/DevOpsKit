import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { listenWithRetry } from "./listen-with-retry.js";

describe("listenWithRetry", () => {
  it("retries when the port is temporarily in use", async () => {
    const app = Fastify();
    const originalListen = app.listen.bind(app);
    const listenSpy = vi.spyOn(app, "listen");

    listenSpy.mockRejectedValueOnce(Object.assign(new Error("in use"), { code: "EADDRINUSE" }));
    listenSpy.mockImplementation((options) => originalListen(options));

    await listenWithRetry(app, {
      port: 0,
      host: "127.0.0.1",
      maxAttempts: 3,
      baseDelayMs: 1,
    });

    expect(listenSpy).toHaveBeenCalledTimes(2);
    await app.close();
  });
});
