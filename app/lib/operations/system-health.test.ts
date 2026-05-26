import { beforeEach, describe, expect, mock, test } from "bun:test";

const queryRaw = mock();

await mock.module("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: queryRaw,
  },
}));

const { getSystemHealth, readBackupSchedule, resolveRealtimeHealthUrl } =
  await import("./system-health");

const now = () => new Date("2026-05-25T10:00:00.000Z");

function testEnv(values: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    ...values,
  };
}

beforeEach(() => {
  queryRaw.mockReset();
  queryRaw.mockResolvedValue([{ "?column?": 1 }]);
});

describe("resolveRealtimeHealthUrl", () => {
  test("uses an explicit realtime health URL", () => {
    expect(
      resolveRealtimeHealthUrl(
        testEnv({
          REALTIME_HEALTH_URL: "http://localhost:3001/health",
        }),
      ),
    ).toBe("http://localhost:3001/health");
  });

  test("derives realtime health from the internal game endpoint", () => {
    expect(
      resolveRealtimeHealthUrl(
        testEnv({
          REALTIME_INTERNAL_URL: "http://localhost:3001/internal/game-update",
        }),
      ),
    ).toBe("http://localhost:3001/health");
  });
});

describe("readBackupSchedule", () => {
  test("reads backup schedule settings with safe defaults", () => {
    expect(readBackupSchedule(testEnv())).toEqual({
      directory: "/backups",
      intervalSeconds: 86400,
      retentionDays: 7,
      scheduled: true,
    });

    expect(
      readBackupSchedule(
        testEnv({
          POSTGRES_BACKUP_DIR: "/var/backups/postgres",
          POSTGRES_BACKUP_DISABLED: "true",
          POSTGRES_BACKUP_INTERVAL_SECONDS: "3600",
          POSTGRES_BACKUP_RETENTION_DAYS: "14",
        }),
      ),
    ).toEqual({
      directory: "/var/backups/postgres",
      intervalSeconds: 3600,
      retentionDays: 14,
      scheduled: false,
    });
  });
});

describe("getSystemHealth", () => {
  test("reports an ok system when all required checks pass", async () => {
    const fetchFn = mock(async () => Response.json({ service: "realtime", status: "ok" }));

    const payload = await getSystemHealth({
      env: testEnv({
        DATABASE_URL: "postgresql://user:secret@database:5432/transcendence?schema=public",
        REALTIME_INTERNAL_URL: "http://realtime:3001/internal/game-update",
      }),
      fetchFn: fetchFn as unknown as typeof fetch,
      now,
      timeoutMs: 1000,
    });

    expect(payload.status).toBe("ok");
    expect(payload.checkedAt).toBe("2026-05-25T10:00:00.000Z");
    expect(payload.summary).toMatchObject({
      degraded: 0,
      ok: 3,
      unreachable: 0,
    });
    expect(payload.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "database",
          status: "ok",
          target: "database:5432/transcendence",
        }),
        expect.objectContaining({
          id: "realtime",
          status: "ok",
          target: "http://realtime:3001/health",
        }),
      ]),
    );
  });

  test("reports unhealthy when database and realtime checks fail", async () => {
    queryRaw.mockRejectedValueOnce(new Error("connection refused"));
    const fetchFn = mock(async () => {
      throw new Error("fetch failed");
    });

    const payload = await getSystemHealth({
      env: testEnv({
        DATABASE_URL: "postgresql://user:secret@database:5432/transcendence?schema=public",
        REALTIME_HEALTH_URL: "http://realtime:3001/health",
      }),
      fetchFn: fetchFn as unknown as typeof fetch,
      now,
      timeoutMs: 1000,
    });

    expect(payload.status).toBe("unhealthy");
    expect(payload.summary.unreachable).toBe(2);
    expect(payload.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail: "PostgreSQL health check failed.",
          id: "database",
          status: "unreachable",
        }),
        expect.objectContaining({
          detail: "Realtime health check failed.",
          id: "realtime",
          status: "unreachable",
        }),
      ]),
    );
  });
});
