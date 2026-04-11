import { backendErrorResponse, proxyToBackend } from "../../_lib/backend-proxy";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    return await proxyToBackend(request, "/api/auth/session", {
      method: "GET",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to reach backend.";
    return backendErrorResponse(message);
  }
}
