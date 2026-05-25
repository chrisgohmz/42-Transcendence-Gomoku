import { getSystemHealth } from "@/lib/operations/system-health";

function statusCodeForHealth(status: "degraded" | "ok" | "unhealthy") {
  return status === "ok" ? 200 : 503;
}

export async function GET() {
  const payload = await getSystemHealth();

  return Response.json(payload, {
    status: statusCodeForHealth(payload.status),
  });
}
