import { beforeEach, describe, expect, mock, test } from "bun:test";

const getSystemHealth = mock();
const getSessionIdentity = mock();

process.env["BETTER_AUTH_SECRET"] ??= "status_route_test_secret_32_bytes";
process.env["BETTER_AUTH_URL"] ??= "http://localhost:3000";

const { createStatusHandler } = await import("./status-handler");

function request(headers?: HeadersInit) {
  return new Request("http://localhost/api/status", { headers });
}

beforeEach(() => {
  getSystemHealth.mockReset();
  getSessionIdentity.mockReset();
  getSessionIdentity.mockResolvedValue({
    session: { id: "session-1" },
    user: { id: "user-1", username: "operator" },
  });
});

describe("GET /api/status", () => {
  const operatorEnv: NodeJS.ProcessEnv = {
    NODE_ENV: "test",
    OPERATIONS_STATUS_USER_IDS: "user-1",
  };

  test("returns 200 when the aggregate system status is ok", async () => {
    getSystemHealth.mockResolvedValueOnce({
      status: "ok",
    });

    const response = await createStatusHandler({
      env: operatorEnv,
      getHealth: getSystemHealth,
      getSessionIdentity,
    })(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ status: "ok" });
  });

  test("returns 503 when the aggregate system status needs attention", async () => {
    getSystemHealth.mockResolvedValueOnce({
      status: "unhealthy",
    });

    const response = await createStatusHandler({
      env: operatorEnv,
      getHealth: getSystemHealth,
      getSessionIdentity,
    })(request());
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({ status: "unhealthy" });
  });

  test("returns 401 before checking detailed health when signed out", async () => {
    getSessionIdentity.mockResolvedValueOnce(null);

    const response = await createStatusHandler({
      env: operatorEnv,
      getHealth: getSystemHealth,
      getSessionIdentity,
    })(request());
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: "unauthorized" });
    expect(getSystemHealth).not.toHaveBeenCalled();
  });

  test("returns 403 before checking detailed health for a signed-in non-operator", async () => {
    const response = await createStatusHandler({
      env: {
        NODE_ENV: "test",
        OPERATIONS_STATUS_USER_IDS: "other-user",
      },
      getHealth: getSystemHealth,
      getSessionIdentity,
    })(request());
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({ error: "forbidden" });
    expect(getSystemHealth).not.toHaveBeenCalled();
  });

  test("allows an internal status token without a browser session", async () => {
    getSystemHealth.mockResolvedValueOnce({
      status: "ok",
    });
    getSessionIdentity.mockResolvedValueOnce(null);

    const response = await createStatusHandler({
      env: {
        NODE_ENV: "test",
        OPERATIONS_STATUS_TOKEN: "monitor-token",
      },
      getHealth: getSystemHealth,
      getSessionIdentity,
    })(request({ "x-operations-status-token": "monitor-token" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(getSessionIdentity).not.toHaveBeenCalled();
  });
});
