import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

describe("dashboard-api", () => {
  it("returns health status", async () => {
    const app = await buildApp();
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok" });
    await app.close();
  });
});
