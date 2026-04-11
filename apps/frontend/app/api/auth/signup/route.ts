import { backendErrorResponse, proxyToBackend } from "../../_lib/backend-proxy";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    return await proxyToBackend(request, "/api/auth/signup");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to reach backend.";
    return backendErrorResponse(message);
  }
}
