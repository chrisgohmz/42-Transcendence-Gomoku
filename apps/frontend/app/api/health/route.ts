export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function GET() {
  const backendUrl =
    process.env["BACKEND_INTERNAL_URL"] ?? "http://backend:3001";

  try {
    const response = await fetch(`${backendUrl}/api/health`, {
      cache: "no-store",
    });
    const backend = (await response.json()) as unknown;

    return Response.json(
      {
        service: "frontend",
        status: response.ok ? "ok" : "degraded",
        backend,
        checkedAt: new Date().toISOString(),
      },
      { status: response.ok ? 200 : 503 },
    );
  } catch (error) {
    return Response.json(
      {
        service: "frontend",
        status: "degraded",
        backend: {
          status: "unreachable",
          error: getErrorMessage(error),
        },
        checkedAt: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
