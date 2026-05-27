import { beforeEach, describe, expect, mock, test } from "bun:test";

const queryRaw = mock();
const connection = mock();

await mock.module("next/server", () => ({
  connection,
}));

await mock.module("../../lib/prisma", () => ({
  prisma: {
    $queryRaw: queryRaw,
  },
}));

const route = await import("./route");

beforeEach(() => {
  connection.mockReset();
  connection.mockResolvedValue(undefined);
  queryRaw.mockReset();
  queryRaw.mockResolvedValue([{ "?column?": 1 }]);
});

describe("GET /api/health", () => {
  test("reports app and database health when the probe succeeds", async () => {
    const response = await route.GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      database: "ok",
      service: "app",
      status: "ok",
    });
    expect(payload.checkedAt).toEqual(expect.any(String));
  });

  test("reports degraded health when the database probe fails", async () => {
    queryRaw.mockRejectedValueOnce(new Error("connection refused"));

    const response = await route.GET();
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({
      database: "unreachable",
      service: "app",
      status: "degraded",
    });
    expect(payload).not.toHaveProperty("error");
  });
});
