import { beforeEach, describe, expect, mock, test } from "bun:test";

const getSystemHealth = mock();

await mock.module("@/lib/operations/system-health", () => ({
  getSystemHealth,
}));

const route = await import("./route");

beforeEach(() => {
  getSystemHealth.mockReset();
});

describe("GET /api/status", () => {
  test("returns 200 when the aggregate system status is ok", async () => {
    getSystemHealth.mockResolvedValueOnce({
      status: "ok",
    });

    const response = await route.GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ status: "ok" });
  });

  test("returns 503 when the aggregate system status needs attention", async () => {
    getSystemHealth.mockResolvedValueOnce({
      status: "unhealthy",
    });

    const response = await route.GET();
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({ status: "unhealthy" });
  });
});
