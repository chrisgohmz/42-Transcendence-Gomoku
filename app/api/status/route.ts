import { getCurrentSessionIdentity } from "@/lib/auth";
import {
  canViewOperationsStatus,
  hasValidOperationsStatusToken,
} from "@/lib/operations/status-access";
import { getSystemHealth } from "@/lib/operations/system-health";

type StatusDependencies = {
  env?: NodeJS.ProcessEnv;
  getHealth?: typeof getSystemHealth;
  getSessionIdentity?: typeof getCurrentSessionIdentity;
};

function statusCodeForHealth(status: "degraded" | "ok" | "unhealthy") {
  return status === "ok" ? 200 : 503;
}

export function createStatusHandler({
  env = process.env,
  getHealth = getSystemHealth,
  getSessionIdentity = getCurrentSessionIdentity,
}: StatusDependencies = {}) {
  return async function GET(request?: Request) {
    const hasStatusToken = hasValidOperationsStatusToken(request, env);
    const session = hasStatusToken ? null : await getSessionIdentity();

    if (!hasStatusToken && !session) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    if (!hasStatusToken && !canViewOperationsStatus(session, env)) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }

    const payload = await getHealth();

    return Response.json(payload, {
      status: statusCodeForHealth(payload.status),
    });
  };
}

export const GET = createStatusHandler();
