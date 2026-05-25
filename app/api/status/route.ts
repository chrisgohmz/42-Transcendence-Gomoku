import { getCurrentSessionIdentity } from "@/lib/auth";
import { getSystemHealth } from "@/lib/operations/system-health";

type StatusDependencies = {
  env?: NodeJS.ProcessEnv;
  getHealth?: typeof getSystemHealth;
  getSessionIdentity?: typeof getCurrentSessionIdentity;
};

const statusTokenHeader = "x-operations-status-token";

function statusCodeForHealth(status: "degraded" | "ok" | "unhealthy") {
  return status === "ok" ? 200 : 503;
}

function hasValidStatusToken(request: Request | undefined, env: NodeJS.ProcessEnv) {
  const configuredToken = env["OPERATIONS_STATUS_TOKEN"]?.trim();
  const suppliedToken = request?.headers.get(statusTokenHeader)?.trim();

  return Boolean(configuredToken && suppliedToken && suppliedToken === configuredToken);
}

export function createStatusHandler({
  env = process.env,
  getHealth = getSystemHealth,
  getSessionIdentity = getCurrentSessionIdentity,
}: StatusDependencies = {}) {
  return async function GET(request?: Request) {
    const session = hasValidStatusToken(request, env) ? true : await getSessionIdentity();

    if (!session) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    const payload = await getHealth();

    return Response.json(payload, {
      status: statusCodeForHealth(payload.status),
    });
  };
}

export const GET = createStatusHandler();
