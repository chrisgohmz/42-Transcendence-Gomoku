import { prisma } from "@/lib/prisma";

export type HealthStatus = "degraded" | "not_configured" | "ok" | "unreachable";

export type SystemStatus = "degraded" | "ok" | "unhealthy";

export type HealthCheckId = "app" | "database" | "realtime";

export type HealthCheckResult = {
  checkedAt: string;
  detail: string;
  id: HealthCheckId;
  label: string;
  responseTimeMs: number;
  role: string;
  status: HealthStatus;
  target: string;
};

export type BackupSchedule = {
  directory: string;
  intervalSeconds: number;
  retentionDays: number;
  scheduled: boolean;
};

export type SystemHealthPayload = {
  backup: BackupSchedule;
  checkedAt: string;
  checks: HealthCheckResult[];
  status: SystemStatus;
  summary: Record<HealthStatus, number>;
};

type FetchFunction = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type SystemHealthOptions = {
  env?: NodeJS.ProcessEnv;
  fetchFn?: FetchFunction;
  now?: () => Date;
  timeoutMs?: number;
};

const defaultRealtimeHealthUrl = "http://realtime:3001/health";
const defaultHealthTimeoutMs = 2000;
const defaultBackupIntervalSeconds = 24 * 60 * 60;
const defaultBackupRetentionDays = 7;
const realtimeInternalPath = "/internal/game-update";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function getElapsedMs(startTime: number) {
  return Math.max(0, Math.round(performance.now() - startTime));
}

function readPositiveInteger(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const rawValue = env[key];
  const value = Number(rawValue);

  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function redactUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function describeDatabaseTarget(env: NodeJS.ProcessEnv): string {
  const databaseUrl = env["DATABASE_URL"];

  if (!databaseUrl) {
    return "DATABASE_URL is not configured";
  }

  try {
    const url = new URL(databaseUrl);
    const port = url.port ? `:${url.port}` : "";
    return `${url.hostname}${port}${url.pathname}`;
  } catch {
    return "Configured database URL";
  }
}

function replacePath(rawUrl: string, pathname: string): string {
  try {
    const url = new URL(rawUrl);
    url.pathname = pathname;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    if (rawUrl.endsWith(realtimeInternalPath)) {
      return `${rawUrl.slice(0, -realtimeInternalPath.length)}${pathname}`;
    }

    return defaultRealtimeHealthUrl;
  }
}

export function resolveRealtimeHealthUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicitHealthUrl = env["REALTIME_HEALTH_URL"];

  if (explicitHealthUrl) {
    return explicitHealthUrl;
  }

  const internalUrl = env["REALTIME_INTERNAL_URL"];

  if (internalUrl) {
    return replacePath(internalUrl, "/health");
  }

  return defaultRealtimeHealthUrl;
}

export function readBackupSchedule(env: NodeJS.ProcessEnv = process.env): BackupSchedule {
  return {
    directory: env["POSTGRES_BACKUP_DIR"] ?? "/backups",
    intervalSeconds: readPositiveInteger(
      env,
      "POSTGRES_BACKUP_INTERVAL_SECONDS",
      defaultBackupIntervalSeconds,
    ),
    retentionDays: readPositiveInteger(
      env,
      "POSTGRES_BACKUP_RETENTION_DAYS",
      defaultBackupRetentionDays,
    ),
    scheduled: env["POSTGRES_BACKUP_DISABLED"] !== "true",
  };
}

async function fetchWithTimeout(
  url: string,
  fetchFn: FetchFunction,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchFn(url, {
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function createAppCheck(checkedAt: string): HealthCheckResult {
  return {
    checkedAt,
    detail: "Next.js app route executed successfully.",
    id: "app",
    label: "App / Gateway",
    responseTimeMs: 0,
    role: "Client-facing Next.js application and API gateway",
    status: "ok",
    target: "current process",
  };
}

async function checkDatabase(
  env: NodeJS.ProcessEnv,
  checkedAt: string,
): Promise<HealthCheckResult> {
  const startedAt = performance.now();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return {
      checkedAt,
      detail: "PostgreSQL accepted a SELECT 1 probe.",
      id: "database",
      label: "PostgreSQL",
      responseTimeMs: getElapsedMs(startedAt),
      role: "Primary relational data store",
      status: "ok",
      target: describeDatabaseTarget(env),
    };
  } catch (error) {
    return {
      checkedAt,
      detail: getErrorMessage(error),
      id: "database",
      label: "PostgreSQL",
      responseTimeMs: getElapsedMs(startedAt),
      role: "Primary relational data store",
      status: "unreachable",
      target: describeDatabaseTarget(env),
    };
  }
}

async function checkRealtime(
  env: NodeJS.ProcessEnv,
  checkedAt: string,
  fetchFn: FetchFunction,
  timeoutMs: number,
): Promise<HealthCheckResult> {
  const realtimeHealthUrl = resolveRealtimeHealthUrl(env);
  const startedAt = performance.now();

  try {
    const response = await fetchWithTimeout(realtimeHealthUrl, fetchFn, timeoutMs);
    const payload = (await response.json().catch(() => null)) as { status?: string } | null;
    const remoteStatus = payload?.status;

    return {
      checkedAt,
      detail: response.ok
        ? `Realtime health endpoint returned ${remoteStatus ?? response.status}.`
        : `Realtime health endpoint returned HTTP ${response.status}.`,
      id: "realtime",
      label: "Realtime Service",
      responseTimeMs: getElapsedMs(startedAt),
      role: "Bun Socket.IO service for live gameplay and chat",
      status: response.ok && remoteStatus === "ok" ? "ok" : "degraded",
      target: redactUrl(realtimeHealthUrl),
    };
  } catch (error) {
    return {
      checkedAt,
      detail: getErrorMessage(error),
      id: "realtime",
      label: "Realtime Service",
      responseTimeMs: getElapsedMs(startedAt),
      role: "Bun Socket.IO service for live gameplay and chat",
      status: "unreachable",
      target: redactUrl(realtimeHealthUrl),
    };
  }
}

function summarizeChecks(checks: HealthCheckResult[]): Record<HealthStatus, number> {
  return checks.reduce(
    (summary, check) => {
      summary[check.status] += 1;
      return summary;
    },
    {
      degraded: 0,
      not_configured: 0,
      ok: 0,
      unreachable: 0,
    } satisfies Record<HealthStatus, number>,
  );
}

function getSystemStatus(summary: Record<HealthStatus, number>): SystemStatus {
  if (summary.unreachable > 0) {
    return "unhealthy";
  }

  if (summary.degraded > 0 || summary.not_configured > 0) {
    return "degraded";
  }

  return "ok";
}

export async function getSystemHealth({
  env = process.env,
  fetchFn = fetch,
  now = () => new Date(),
  timeoutMs = readPositiveInteger(env, "SYSTEM_HEALTH_TIMEOUT_MS", defaultHealthTimeoutMs),
}: SystemHealthOptions = {}): Promise<SystemHealthPayload> {
  const checkedAt = now().toISOString();
  const [database, realtime] = await Promise.all([
    checkDatabase(env, checkedAt),
    checkRealtime(env, checkedAt, fetchFn, timeoutMs),
  ]);
  const checks = [createAppCheck(checkedAt), database, realtime];
  const summary = summarizeChecks(checks);

  return {
    backup: readBackupSchedule(env),
    checkedAt,
    checks,
    status: getSystemStatus(summary),
    summary,
  };
}
